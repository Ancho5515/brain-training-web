using System.Net;
using System.Security.Claims;
using System.Text.Json;
using BrainTraining.Server;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
if (string.IsNullOrWhiteSpace(builder.Configuration["urls"]))
    builder.WebHost.UseUrls("http://0.0.0.0:8787");

// The deployment supplies --data-dir outside its versioned release directory.
var dataDirectory = Path.GetFullPath(builder.Configuration["data-dir"]
    ?? builder.Configuration["BRAIN_DATA_DIR"]
    ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BrainTrainingWeb", "data"));
Directory.CreateDirectory(dataDirectory);
var keysDirectory = Directory.CreateDirectory(Path.Combine(dataDirectory, "keys"));
builder.Services.AddDataProtection().SetApplicationName("brain-training-web").PersistKeysToFileSystem(keysDirectory);
builder.Services.AddDbContext<BrainDbContext>(options => options.UseSqlite(new SqliteConnectionStringBuilder
{
    DataSource = Path.Combine(dataDirectory, "brain-training.db"),
    ForeignKeys = true,
    Pooling = false
}.ToString()));
builder.Services.AddIdentityCore<TrainingUser>(options =>
{
    options.Password.RequiredLength = 8;
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireUppercase = false;
    options.Password.RequireNonAlphanumeric = false;
}).AddEntityFrameworkStores<BrainDbContext>();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options =>
{
    options.Cookie.Name = "brain.session";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    options.ExpireTimeSpan = TimeSpan.FromDays(30);
    options.SlidingExpiration = true;
    options.Events.OnRedirectToLogin = context => { context.Response.StatusCode = 401; return Task.CompletedTask; };
    options.Events.OnRedirectToAccessDenied = context => { context.Response.StatusCode = 403; return Task.CompletedTask; };
    options.Events.OnValidatePrincipal = SessionSecurity.Validate;
});
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "brain.csrf";
    options.Cookie.HttpOnly = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});
builder.Services.AddSingleton<RequestThrottle>();
builder.Services.ConfigureHttpJsonOptions(options => options.SerializerOptions.MaxDepth = 8);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 32_768);
var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BrainDbContext>();
    db.Database.EnsureCreated();
    db.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL;");
}

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "same-origin";
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.Headers.CacheControl = "no-store";
        if (context.Request.ContentLength > 32_768)
        {
            context.Response.StatusCode = 413;
            return;
        }
        if (context.Request.Path != "/api/health")
            await DeviceSecurity.Establish(context);
    }
    await next();
});
app.UseAuthentication();
// Validate before authorization and body binding: even login/registration need CSRF.
app.Use(async (context, next) =>
{
    if (HttpMethods.IsPost(context.Request.Method) && context.Request.Path.StartsWithSegments("/api"))
    {
        try { await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context); }
        catch (AntiforgeryValidationException)
        {
            await Results.BadRequest(new { code = "csrf_required", error = "请刷新页面后重试。" }).ExecuteAsync(context);
            return;
        }
        var throttle = context.RequestServices.GetRequiredService<RequestThrottle>();
        var device = DeviceSecurity.Current(context);
        if (!throttle.AllowWrite(device.Id, context.Request.Path == "/api/accounts"))
        {
            context.Response.Headers.RetryAfter = "60";
            context.Response.StatusCode = 429;
            return;
        }
    }
    await next();
});
app.UseAuthorization();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok", application = "brain-training-web", version = AppVersion.Value }));

app.MapGet("/api/bootstrap", async (HttpContext context, BrainDbContext db, IAntiforgery antiforgery) =>
{
    var device = DeviceSecurity.Current(context);
    var accounts = await db.Users.AsNoTracking().Where(x => x.DeviceId == device.Id).OrderBy(x => x.CreatedAtUtc)
        .Select(x => new AccountDto(x.Id, x.DisplayName)).ToListAsync();
    AccountDto? user = context.User.Identity?.IsAuthenticated == true
        ? accounts.SingleOrDefault(x => x.Id.ToString() == context.User.FindFirstValue(ClaimTypes.NameIdentifier)) : null;
    var token = antiforgery.GetAndStoreTokens(context).RequestToken;
    return Results.Ok(new { device = new { device.Id, device.Name, device.FirstSeenUtc, device.LastSeenUtc }, accounts, user,
        csrfToken = token, isHost = HostSecurity.IsHost(context), version = AppVersion.Value });
});

app.MapPost("/api/accounts", async (AccountRequest request, HttpContext context, UserManager<TrainingUser> users, BrainDbContext db) =>
{
    if (!InputRules.Text(request.DisplayName, 40) || !InputRules.Password(request.Password))
        return Results.BadRequest(new { error = "昵称需1–40字，密码需8–128字。" });
    var displayName = request.DisplayName!.Trim().Normalize();
    var normalizedName = displayName.ToUpperInvariant();
    var device = DeviceSecurity.Current(context);
    if (await db.Users.AnyAsync(x => x.DeviceId == device.Id && x.NormalizedDisplayName == normalizedName))
        return Results.Conflict(new { error = "本设备已有这个昵称。" });
    var id = Guid.NewGuid();
    var user = new TrainingUser { Id = id, UserName = id.ToString("N"), DisplayName = displayName, NormalizedDisplayName = normalizedName,
        DeviceId = device.Id, CreatedAtUtc = DateTime.UtcNow };
    var result = await users.CreateAsync(user, request.Password!);
    if (!result.Succeeded) return Results.BadRequest(new { error = "无法创建账号，请检查昵称与密码。" });
    return Results.Created("/api/accounts/" + user.Id, new AccountDto(user.Id, user.DisplayName));
});

app.MapPost("/api/login", async (LoginRequest request, HttpContext context, UserManager<TrainingUser> users, RequestThrottle throttle) =>
{
    if (request.AccountId is null || request.AccountId == Guid.Empty || !InputRules.Password(request.Password))
        return Results.BadRequest(new { error = "账号或密码格式无效。" });
    var device = DeviceSecurity.Current(context);
    if (throttle.LoginBlocked(device.Id))
    {
        context.Response.Headers.RetryAfter = "300";
        return Results.StatusCode(429);
    }
    var user = await users.FindByIdAsync(request.AccountId.Value.ToString());
    if (user is null || user.DeviceId != device.Id || !await users.CheckPasswordAsync(user, request.Password!))
    {
        throttle.LoginFailed(device.Id);
        return Results.Unauthorized();
    }
    throttle.LoginSucceeded(device.Id);
    await SessionSecurity.SignIn(context, user);
    return Results.Ok(new AccountDto(user.Id, user.DisplayName));
});

app.MapPost("/api/logout", async (HttpContext context) =>
{
    await context.SignOutAsync();
    return Results.NoContent();
});

app.MapPost("/api/device/name", async (DeviceNameRequest request, HttpContext context, BrainDbContext db) =>
{
    if (!InputRules.Text(request.Name, 80)) return Results.BadRequest(new { error = "设备名称需1–80字。" });
    var device = DeviceSecurity.Current(context);
    device.Name = request.Name!.Trim().Normalize();
    await db.SaveChangesAsync();
    return Results.Ok(new { device.Id, device.Name });
});

app.MapGet("/api/host/devices", async (HttpContext context, BrainDbContext db) =>
{
    if (!HostSecurity.IsHost(context)) return Results.StatusCode(403);
    var devices = await db.Devices.AsNoTracking().OrderByDescending(x => x.LastSeenUtc)
        .Select(x => new { x.Id, x.Name, x.UserAgent, x.FirstSeenUtc, x.LastSeenUtc, x.LastIp,
            accountCount = db.Users.Count(u => u.DeviceId == x.Id) }).ToListAsync();
    return Results.Ok(devices);
});

app.MapGet("/api/records", async (HttpContext context, BrainDbContext db) => Results.Ok(await RecordQueries.Load(context, db))).RequireAuthorization();

app.MapPost("/api/records", async (RunRequest request, HttpContext context, BrainDbContext db) =>
{
    if (!InputRules.Run(request)) return Results.BadRequest(new { error = "训练记录格式无效。" });
    var userId = SessionSecurity.UserId(context);
    if (await db.Runs.AnyAsync(x => x.UserId == userId && x.Id == request.Id)) return Results.Ok();
    var run = new TrainingRun { UserId = userId, Id = request.Id!.Value, GameId = request.GameId!.Value, Level = request.Level!.Value,
        Seed = request.Seed!.Value, Score = request.Score!.Value, Accuracy = request.Accuracy!.Value,
        DurationMs = request.DurationMs!.Value, MetricsJson = request.Metrics.GetRawText(), CompletedAtUtc = DateTime.UtcNow };
    db.Runs.Add(run);
    try { await db.SaveChangesAsync(); }
    catch (DbUpdateException exception) when (exception.InnerException is SqliteException { SqliteErrorCode: 19 })
    {
        // A simultaneous retry can lose the unique-key race, but never overwrite.
        db.Entry(run).State = EntityState.Detached;
        if (await db.Runs.AnyAsync(x => x.UserId == userId && x.Id == request.Id)) return Results.Ok();
        throw;
    }
    return Results.Created("/api/records", null);
}).RequireAuthorization();

app.MapGet("/api/records/export", async (HttpContext context, BrainDbContext db) =>
{
    var bytes = JsonSerializer.SerializeToUtf8Bytes(await RecordQueries.Load(context, db), new JsonSerializerOptions(JsonSerializerDefaults.Web));
    return Results.File(bytes, "application/json; charset=utf-8", "brain-training-records-" + DateTime.UtcNow.ToString("yyyyMMdd") + ".json");
}).RequireAuthorization();

app.MapPost("/api/password", async (PasswordRequest request, HttpContext context, UserManager<TrainingUser> users, RequestThrottle throttle) =>
{
    if (!InputRules.Password(request.CurrentPassword) || !InputRules.Password(request.NewPassword))
        return Results.BadRequest(new { error = "密码需8–128字。" });
    var device = DeviceSecurity.Current(context);
    if (throttle.LoginBlocked(device.Id)) return Results.StatusCode(429);
    var user = await users.FindByIdAsync(SessionSecurity.UserId(context).ToString());
    if (user is null || !await users.CheckPasswordAsync(user, request.CurrentPassword!))
    {
        throttle.LoginFailed(device.Id);
        return Results.Unauthorized();
    }
    var result = await users.ChangePasswordAsync(user, request.CurrentPassword!, request.NewPassword!);
    if (!result.Succeeded) return Results.BadRequest(new { error = "无法修改密码。" });
    throttle.LoginSucceeded(device.Id);
    // Updating Identity's security stamp revokes every previously issued session.
    await context.SignOutAsync();
    return Results.NoContent();
}).RequireAuthorization();

app.UseDefaultFiles();
app.UseStaticFiles();
// Never return the SPA document for an unknown API or missing asset.
app.MapFallback(async context =>
{
    if (context.Request.Path.StartsWithSegments("/api") || Path.HasExtension(context.Request.Path)
        || !HttpMethods.IsGet(context.Request.Method))
    {
        context.Response.StatusCode = 404;
        return;
    }
    var index = Path.Combine(app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "index.html");
    if (!File.Exists(index)) { context.Response.StatusCode = 404; return; }
    context.Response.ContentType = "text/html; charset=utf-8";
    await context.Response.SendFileAsync(index);
});
app.Run();

public partial class Program;

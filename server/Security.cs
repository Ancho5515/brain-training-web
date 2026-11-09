using System.Collections.Concurrent;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;

namespace BrainTraining.Server;

internal static class DeviceSecurity
{
    private const string CookieName = "brain.device";
    public static BrowserDevice Current(HttpContext context) => (BrowserDevice)context.Items[typeof(BrowserDevice)]!;

    public static async Task Establish(HttpContext context)
    {
        var db = context.RequestServices.GetRequiredService<BrainDbContext>();
        BrowserDevice? device = null;
        var token = context.Request.Cookies[CookieName];
        if (token is { Length: 43 } && token.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_'))
        {
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.ASCII.GetBytes(token)));
            device = await db.Devices.SingleOrDefaultAsync(x => x.TokenHash == hash);
        }
        if (device is null)
        {
            token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
            device = new BrowserDevice { Id = Guid.NewGuid(), TokenHash = Convert.ToHexString(SHA256.HashData(Encoding.ASCII.GetBytes(token))), FirstSeenUtc = DateTime.UtcNow };
            db.Devices.Add(device);
            context.Response.Cookies.Append(CookieName, token, new CookieOptions { HttpOnly = true, IsEssential = true,
                SameSite = SameSiteMode.Strict, Secure = context.Request.IsHttps, Path = "/", MaxAge = TimeSpan.FromDays(3650) });
        }
        device.LastSeenUtc = DateTime.UtcNow;
        device.LastIp = Limit(context.Connection.RemoteIpAddress?.ToString() ?? "", 64);
        device.UserAgent = Limit(context.Request.Headers.UserAgent.ToString(), 512);
        context.Items[typeof(BrowserDevice)] = device;
        await db.SaveChangesAsync();
    }
    private static string Limit(string value, int limit) => value.Length <= limit ? value : value[..limit];
}

internal static class HostSecurity
{
    // Forwarded headers are deliberately not trusted for the local host gate.
    public static bool IsHost(HttpContext context) => context.Connection.RemoteIpAddress is { } address && IPAddress.IsLoopback(address);
}

internal static class SessionSecurity
{
    public static Guid UserId(HttpContext context) => Guid.Parse(context.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    public static async Task SignIn(HttpContext context, TrainingUser user)
    {
        var claims = new[] { new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Name, user.DisplayName),
            new Claim("device_id", user.DeviceId.ToString()), new Claim("security_stamp", user.SecurityStamp!) };
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)),
            new AuthenticationProperties { IsPersistent = true, ExpiresUtc = DateTimeOffset.UtcNow.AddDays(30), AllowRefresh = true });
    }

    public static async Task Validate(CookieValidatePrincipalContext context)
    {
        var http = context.HttpContext;
        var device = http.Items[typeof(BrowserDevice)] as BrowserDevice;
        // Static resources and health never grant access to user data.
        if (!http.Request.Path.StartsWithSegments("/api") || http.Request.Path == "/api/health") return;
        var db = http.RequestServices.GetRequiredService<BrainDbContext>();
        var principal = context.Principal!;
        TrainingUser? user = null;
        if (Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
            user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Id == userId);
        if (device is null || user is null || user.DeviceId != device.Id
            || principal.FindFirstValue("device_id") != device.Id.ToString()
            || principal.FindFirstValue("security_stamp") != user.SecurityStamp)
        {
            context.RejectPrincipal();
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        }
    }
}

internal static class InputRules
{
    public static bool Text(string? value, int limit) => value is not null && !string.IsNullOrWhiteSpace(value)
        && value.Length <= limit && !value.Any(char.IsControl);
    public static bool Password(string? value) => value is { Length: >= 8 and <= 128 } && !string.IsNullOrWhiteSpace(value);
    public static bool Run(RunRequest run)
    {
        if (run.Id is null || run.Id == Guid.Empty || run.GameId is null or < 1 or > 40 || run.Level is null or < 1 or > 30
            || run.Seed is null or < -9_007_199_254_740_991 or > 9_007_199_254_740_991
            || run.Score is null or < 0 or > 100 || !double.IsFinite(run.Score.Value)
            || run.Accuracy is null or < 0 or > 1 || !double.IsFinite(run.Accuracy.Value)
            || run.DurationMs is null or < 0 or > 86_400_000 || run.Metrics.ValueKind != JsonValueKind.Object || run.Metrics.GetRawText().Length > 8192)
            return false;
        var count = 0;
        foreach (var property in run.Metrics.EnumerateObject())
        {
            if (++count > 64 || !Text(property.Name, 64)) return false;
            switch (property.Value.ValueKind)
            {
                case JsonValueKind.String:
                    if (property.Value.GetString()!.Length > 256) return false;
                    break;
                case JsonValueKind.Number:
                    if (!property.Value.TryGetDouble(out var number) || !double.IsFinite(number) || Math.Abs(number) > 9_007_199_254_740_991) return false;
                    break;
                case JsonValueKind.True:
                case JsonValueKind.False: break;
                default: return false;
            }
        }
        return true;
    }
}

internal sealed class RequestThrottle
{
    private sealed class Window
    {
        public DateTime Start = DateTime.UtcNow;
        public int Count;
    }
    private readonly ConcurrentDictionary<(Guid, string), Window> windows = new();

    public bool AllowWrite(Guid device, bool registration) => Increment(device, registration ? "register" : "write", registration ? 10 : 120, TimeSpan.FromMinutes(1));
    public bool LoginBlocked(Guid device)
    {
        if (!windows.TryGetValue((device, "login"), out var window)) return false;
        lock (window) return DateTime.UtcNow - window.Start < TimeSpan.FromMinutes(5) && window.Count >= 5;
    }
    public void LoginFailed(Guid device) => Increment(device, "login", int.MaxValue, TimeSpan.FromMinutes(5));
    public void LoginSucceeded(Guid device) => windows.TryRemove((device, "login"), out _);
    private bool Increment(Guid device, string purpose, int limit, TimeSpan interval)
    {
        // Prune expired device buckets so forgotten cookies do not retain memory.
        if (windows.Count > 4096)
            foreach (var pair in windows.Where(x => DateTime.UtcNow - x.Value.Start > TimeSpan.FromMinutes(10))) windows.TryRemove(pair.Key, out _);
        var window = windows.GetOrAdd((device, purpose), _ => new Window());
        lock (window)
        {
            if (DateTime.UtcNow - window.Start >= interval) { window.Start = DateTime.UtcNow; window.Count = 0; }
            window.Count++;
            return window.Count <= limit;
        }
    }
}

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace BrainTraining.Server.Tests;

public sealed class ApiTests
{
    [Fact]
    public async Task Bootstrap_persists_device_cookie_and_groups_only_its_own_accounts()
    {
        using var site = new Site();
        using var first = site.Browser();
        using var other = site.Browser();
        var before = await first.Bootstrap();
        Assert.Null(before["user"]);
        Assert.NotNull(before["csrfToken"]);
        var device = before["device"]!["id"]!.GetValue<string>();
        var account = await first.Register("同名昵称");
        await first.Register("第二个账号");
        var after = await first.Bootstrap();
        Assert.Equal(device, after["device"]!["id"]!.GetValue<string>());
        Assert.Equal(2, after["accounts"]!.AsArray().Count);
        Assert.Null(after["user"]);
        var otherBootstrap = await other.Bootstrap();
        Assert.NotEqual(device, otherBootstrap["device"]!["id"]!.GetValue<string>());
        Assert.Empty(otherBootstrap["accounts"]!.AsArray());
        var duplicateNameOtherDevice = await other.Register("同名昵称");
        Assert.NotEqual(account, duplicateNameOtherDevice);
        Assert.Contains(first.Cookies.Keys, key => key.Contains("device", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(first.SetCookies, cookie => cookie.Contains("HttpOnly", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Device_timestamps_are_unambiguously_utc_when_read_back_from_storage()
    {
        using var site = new Site();
        using var browser = site.Browser();
        await browser.Bootstrap();
        var second = await browser.Bootstrap();
        Assert.EndsWith("Z", second["device"]!["firstSeenUtc"]!.GetValue<string>());
        Assert.EndsWith("Z", second["device"]!["lastSeenUtc"]!.GetValue<string>());
    }

    [Fact]
    public async Task Clearing_device_cookie_starts_a_new_device_without_deleting_the_old_accounts()
    {
        using var site = new Site();
        using var browser = site.Browser();
        var account = await browser.Register("旧设备账号");
        await browser.Login(account);
        var oldCookies = new Dictionary<string, string>(browser.Cookies);
        var oldDevice = (await browser.Bootstrap())["device"]!["id"]!.GetValue<string>();
        browser.Cookies.Remove("brain.device");
        var fresh = await browser.Bootstrap();
        Assert.NotEqual(oldDevice, fresh["device"]!["id"]!.GetValue<string>());
        Assert.Empty(fresh["accounts"]!.AsArray());
        Assert.Null(fresh["user"]);
        using var original = site.Browser(oldCookies);
        Assert.Single((await original.Bootstrap())["accounts"]!.AsArray());
        Assert.Equal(account, (await original.Bootstrap())["user"]!["id"]!.GetValue<string>());
    }

    [Fact]
    public async Task Login_requires_password_and_device_and_logout_removes_access()
    {
        using var site = new Site();
        using var owner = site.Browser();
        using var stranger = site.Browser();
        var account = await owner.Register("小明");
        Assert.Equal(HttpStatusCode.Unauthorized, (await owner.Post("/api/login", new { accountId = account, password = "wrong-password" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await stranger.Post("/api/login", new { accountId = account, password = Browser.Password })).StatusCode);
        await owner.Login(account);
        Assert.Equal(account, (await owner.Bootstrap())["user"]!["id"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.OK, (await owner.Get("/api/records")).StatusCode);
        foreach (var cookie in owner.Cookies.Where(x => !x.Key.Contains("device", StringComparison.OrdinalIgnoreCase)))
            stranger.Cookies[cookie.Key] = cookie.Value;
        Assert.Equal(HttpStatusCode.Unauthorized, (await stranger.Get("/api/records")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await owner.Post("/api/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await owner.Get("/api/records")).StatusCode);
    }

    [Fact]
    public async Task Every_post_including_register_and_login_requires_valid_csrf()
    {
        using var site = new Site();
        using var browser = site.Browser();
        await browser.Bootstrap();
        foreach (var route in new[] { "/api/accounts", "/api/login", "/api/logout", "/api/device/name", "/api/records", "/api/password" })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await browser.Post(route, new { }, csrf: false)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await browser.Post(route, new { }, csrf: false, token: "forged")).StatusCode);
        }
    }

    [Fact]
    public async Task Runs_are_private_idempotent_and_progress_and_export_reflect_saved_values()
    {
        using var site = new Site();
        using var browser = site.Browser();
        var account = await browser.Register("第一人");
        var second = await browser.Register("第二人");
        await browser.Login(account);
        var id = Guid.NewGuid().ToString();
        var run = Run(id);
        Assert.Equal(HttpStatusCode.Created, (await browser.Post("/api/records", run)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await browser.Post("/api/records", new { id, gameId = 1, level = 1, seed = 3, score = 0, accuracy = 0, durationMs = 2, metrics = new { } })).StatusCode);
        var saved = await Browser.Json(await browser.Get("/api/records"));
        Assert.Single(saved["records"]!.AsArray());
        Assert.Equal(80, saved["records"]![0]!["score"]!.GetValue<int>());
        Assert.Equal("111", saved["records"]![0]!["seed"]!.ToJsonString());
        Assert.NotNull(saved["records"]![0]!["completedAtUtc"]);
        Assert.Equal(7, saved["progress"]![0]!["highestLevel"]!.GetValue<int>());
        Assert.Equal(1, saved["progress"]![0]!["plays"]!.GetValue<int>());
        var export = await browser.Get("/api/records/export");
        Assert.Equal(HttpStatusCode.OK, export.StatusCode);
        Assert.Contains("attachment", export.Content.Headers.ContentDisposition!.ToString());
        Assert.Single((await Browser.Json(export))["records"]!.AsArray());
        await browser.Login(second);
        Assert.Empty((await Browser.Json(await browser.Get("/api/records")))["records"]!.AsArray());
        Assert.Equal(HttpStatusCode.Created, (await browser.Post("/api/records", Run(id))).StatusCode);
        await browser.Login(account);
        Assert.Single((await Browser.Json(await browser.Get("/api/records")))["records"]!.AsArray());
    }

    [Fact]
    public async Task Device_credentials_accounts_sessions_and_runs_survive_a_server_restart()
    {
        var directory = Path.Combine(Path.GetTempPath(), "brain-test-" + Guid.NewGuid().ToString("N"));
        Dictionary<string, string> cookies;
        string account;
        string device;
        try
        {
            using (var site = new Site(directory))
            using (var browser = site.Browser())
            {
                account = await browser.Register("重启测试");
                await browser.Login(account);
                device = (await browser.Bootstrap())["device"]!["id"]!.GetValue<string>();
                Assert.Equal(HttpStatusCode.Created, (await browser.Post("/api/records", Run(Guid.NewGuid().ToString()))).StatusCode);
                cookies = new(browser.Cookies);
            }
            using var restarted = new Site(directory);
            using var restored = restarted.Browser(cookies);
            var boot = await restored.Bootstrap();
            Assert.Equal(device, boot["device"]!["id"]!.GetValue<string>());
            Assert.Equal(account, boot["user"]!["id"]!.GetValue<string>());
            Assert.Single((await Browser.Json(await restored.Get("/api/records")))["records"]!.AsArray());
            Assert.NotEmpty(Directory.GetFiles(directory, "*.db"));
            Assert.NotEmpty(Directory.GetFiles(Path.Combine(directory, "keys"), "*.xml"));
            Assert.DoesNotContain(Browser.Password, await File.ReadAllTextAsync(Directory.GetFiles(directory, "*.db").Single()));
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }

    [Fact]
    public async Task Password_change_rejects_wrong_password_and_revokes_other_sessions()
    {
        using var site = new Site();
        using var browser = site.Browser();
        var account = await browser.Register("修改密码");
        await browser.Login(account);
        using var oldSession = site.Browser(new(browser.Cookies));
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.Post("/api/password", new { currentPassword = "incorrect", newPassword = "replacement-password" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await browser.Post("/api/password", new { currentPassword = Browser.Password, newPassword = "replacement-password" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await oldSession.Get("/api/records")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await browser.Post("/api/login", new { accountId = account, password = Browser.Password })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await browser.Post("/api/login", new { accountId = account, password = "replacement-password" })).StatusCode);
    }

    [Fact]
    public async Task Invalid_inputs_are_rejected_without_saving_records()
    {
        using var site = new Site();
        using var browser = site.Browser();
        foreach (var payload in new[] { new { displayName = "", password = Browser.Password }, new { displayName = new string('a', 41), password = Browser.Password }, new { displayName = "ok", password = "a" } })
            Assert.Equal(HttpStatusCode.BadRequest, (await browser.Post("/api/accounts", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await browser.Post("/api/login", new { accountId = "not-a-uuid", password = Browser.Password })).StatusCode);
        var account = await browser.Register("输入校验");
        await browser.Login(account);
        var valid = JsonSerializer.SerializeToNode(Run(Guid.NewGuid().ToString()))!.AsObject();
        foreach (var pair in new (string Key, object? Value)[] { ("id", "bad"), ("id", Guid.Empty.ToString()), ("gameId", 0), ("gameId", 41), ("level", 0), ("level", 31), ("score", -1), ("score", 101), ("accuracy", -0.01), ("accuracy", 1.01), ("durationMs", -1), ("durationMs", 86_400_001), ("seed", 1e100), ("metrics", "bad"), ("metrics", new { nested = new { value = 1 } }) })
        {
            var invalid = valid.DeepClone().AsObject();
            invalid[pair.Key] = JsonSerializer.SerializeToNode(pair.Value);
            Assert.Equal(HttpStatusCode.BadRequest, (await browser.Post("/api/records", invalid)).StatusCode);
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await browser.Post("/api/device/name", new { name = new string('a', 81) })).StatusCode);
        Assert.Empty((await Browser.Json(await browser.Get("/api/records")))["records"]!.AsArray());
    }

    [Fact]
    public async Task Repeated_failed_logins_are_rate_limited_per_device()
    {
        using var site = new Site();
        using var browser = site.Browser();
        var account = await browser.Register("限速");
        var statuses = new List<HttpStatusCode>();
        for (var attempt = 0; attempt < 12; attempt++)
            statuses.Add((await browser.Post("/api/login", new { accountId = account, password = "incorrect" })).StatusCode);
        Assert.Contains(HttpStatusCode.TooManyRequests, statuses);
    }

    [Fact]
    public async Task Host_inventory_is_denied_without_loopback_remote_address_and_health_identifies_app()
    {
        using var site = new Site();
        using var browser = site.Browser();
        Assert.False((await browser.Bootstrap())["isHost"]!.GetValue<bool>());
        Assert.Equal(HttpStatusCode.Forbidden, (await browser.Get("/api/host/devices")).StatusCode);
        var health = await Browser.Json(await browser.Get("/api/health"));
        Assert.Equal("ok", health["status"]!.GetValue<string>());
        Assert.Equal("brain-training-web", health["application"]!.GetValue<string>());
        Assert.NotEmpty(health["version"]!.GetValue<string>());
        Assert.Equal(HttpStatusCode.NotFound, (await browser.Get("/api/unknown")).StatusCode);
    }

    [Fact]
    public async Task Host_inventory_shows_metadata_and_account_count_but_never_credentials()
    {
        using var site = new Site(remoteAddress: IPAddress.Loopback);
        using var browser = site.Browser();
        await browser.Register("本机账号");
        Assert.Equal(HttpStatusCode.OK, (await browser.Post("/api/device/name", new { name = "大厅平板" })).StatusCode);
        Assert.True((await browser.Bootstrap())["isHost"]!.GetValue<bool>());
        var response = await browser.Get("/api/host/devices");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var text = await response.Content.ReadAsStringAsync();
        var devices = System.Text.Json.Nodes.JsonNode.Parse(text)!.AsArray();
        Assert.Single(devices);
        Assert.Equal("大厅平板", devices[0]!["name"]!.GetValue<string>());
        Assert.Equal(1, devices[0]!["accountCount"]!.GetValue<int>());
        Assert.Equal("127.0.0.1", devices[0]!["lastIp"]!.GetValue<string>());
        Assert.NotNull(devices[0]!["userAgent"]);
        Assert.EndsWith("Z", devices[0]!["firstSeenUtc"]!.GetValue<string>());
        Assert.DoesNotContain("tokenHash", text, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("password", text, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task A_lan_client_cannot_spoof_loopback_with_forwarded_headers()
    {
        using var site = new Site(remoteAddress: IPAddress.Parse("192.168.1.20"));
        using var browser = site.Browser();
        browser.Headers["X-Forwarded-For"] = "127.0.0.1";
        browser.Headers["Forwarded"] = "for=127.0.0.1";
        Assert.False((await browser.Bootstrap())["isHost"]!.GetValue<bool>());
        Assert.Equal(HttpStatusCode.Forbidden, (await browser.Get("/api/host/devices")).StatusCode);
    }

    [Fact]
    public async Task Device_identity_survives_changes_of_ip_and_user_agent()
    {
        var directory = Path.Combine(Path.GetTempPath(), "brain-test-" + Guid.NewGuid().ToString("N"));
        try
        {
            Dictionary<string, string> cookies;
            string deviceId;
            string account;
            using (var site = new Site(directory, IPAddress.Parse("192.168.1.11")))
            using (var browser = site.Browser())
            {
                browser.Headers["User-Agent"] = "First browser agent";
                account = await browser.Register("移动平板");
                await browser.Login(account);
                deviceId = (await browser.Bootstrap())["device"]!["id"]!.GetValue<string>();
                cookies = new(browser.Cookies);
            }
            using var changedSite = new Site(directory, IPAddress.Parse("192.168.1.19"));
            using var changedBrowser = changedSite.Browser(cookies);
            changedBrowser.Headers["User-Agent"] = "Updated browser agent";
            var boot = await changedBrowser.Bootstrap();
            Assert.Equal(deviceId, boot["device"]!["id"]!.GetValue<string>());
            Assert.Equal(account, boot["user"]!["id"]!.GetValue<string>());
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }

    [Fact]
    public async Task Static_host_serves_client_routes_but_never_masks_unknown_api_or_asset_paths()
    {
        var webRoot = Path.Combine(Path.GetTempPath(), "brain-web-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(webRoot);
        await File.WriteAllTextAsync(Path.Combine(webRoot, "index.html"), "<!doctype html><title>训练首页</title>");
        await File.WriteAllTextAsync(Path.Combine(webRoot, "app.css"), "body { color: navy; }");
        try
        {
            using var site = new Site(webRoot: webRoot);
            using var browser = site.Browser();
            foreach (var route in new[] { "/", "/games/3", "/history" })
            {
                var response = await browser.Get(route);
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                Assert.Contains("训练首页", await response.Content.ReadAsStringAsync());
            }
            Assert.Equal("body { color: navy; }", await (await browser.Get("/app.css")).Content.ReadAsStringAsync());
            Assert.Equal(HttpStatusCode.NotFound, (await browser.Get("/missing.js")).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await browser.Get("/api/missing")).StatusCode);
        }
        finally { Directory.Delete(webRoot, true); }
    }

    private static object Run(string id) => new { id, gameId = 3, level = 7, seed = 111, score = 80, accuracy = 0.75, durationMs = 1200, metrics = new { correct = 3, label = "三回合", complete = true } };
}

internal sealed class Site : WebApplicationFactory<Program>
{
    private readonly bool delete;
    private readonly IPAddress? remoteAddress;
    private readonly string? webRoot;
    public string DirectoryPath { get; }
    public Site(string? directory = null, IPAddress? remoteAddress = null, string? webRoot = null)
    {
        delete = directory is null;
        this.remoteAddress = remoteAddress;
        this.webRoot = webRoot;
        DirectoryPath = directory ?? Path.Combine(Path.GetTempPath(), "brain-test-" + Guid.NewGuid().ToString("N"));
    }
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("data-dir", DirectoryPath).UseEnvironment("Testing");
        if (webRoot is not null) builder.UseWebRoot(webRoot);
        if (remoteAddress is not null) builder.ConfigureServices(services => services.AddSingleton<IStartupFilter>(new RemoteAddressFilter(remoteAddress)));
    }
    public Browser Browser(Dictionary<string, string>? cookies = null) => new(CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false, AllowAutoRedirect = false }), cookies);
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (delete && Directory.Exists(DirectoryPath)) Directory.Delete(DirectoryPath, true);
    }
}

internal sealed class RemoteAddressFilter(IPAddress address) : IStartupFilter
{
    public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
    {
        app.Use((context, continuation) => { context.Connection.RemoteIpAddress = address; return continuation(); });
        next(app);
    };
}

internal sealed class Browser(HttpClient client, Dictionary<string, string>? cookies = null) : IDisposable
{
    public const string Password = "correct-test-password";
    public Dictionary<string, string> Cookies { get; } = cookies ?? new();
    public Dictionary<string, string> Headers { get; } = new();
    public List<string> SetCookies { get; } = [];
    public async Task<System.Text.Json.Nodes.JsonObject> Bootstrap() => await Json(await Get("/api/bootstrap"));
    public async Task<string> Register(string displayName)
    {
        var response = await Post("/api/accounts", new { displayName, password = Password });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Json(response))["id"]!.GetValue<string>();
    }
    public async Task Login(string account)
    {
        var response = await Post("/api/login", new { accountId = account, password = Password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
    public Task<HttpResponseMessage> Get(string path) => Send(new(HttpMethod.Get, path));
    public async Task<HttpResponseMessage> Post(string path, object? body, bool csrf = true, string? token = null)
    {
        if (csrf) token = (await Bootstrap())["csrfToken"]!.GetValue<string>();
        var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(body) };
        if (token is not null) request.Headers.Add("X-CSRF-TOKEN", token);
        return await Send(request);
    }
    private async Task<HttpResponseMessage> Send(HttpRequestMessage request)
    {
        foreach (var header in Headers) request.Headers.TryAddWithoutValidation(header.Key, header.Value);
        if (Cookies.Count > 0) request.Headers.Add("Cookie", string.Join("; ", Cookies.Select(x => x.Key + "=" + x.Value)));
        var response = await client.SendAsync(request);
        if (response.Headers.TryGetValues("Set-Cookie", out var setCookies))
            foreach (var cookie in setCookies)
            {
                SetCookies.Add(cookie);
                var first = cookie.Split(';', 2)[0];
                var pair = first.Split('=', 2);
                if (pair[1] == "") Cookies.Remove(pair[0]);
                else Cookies[pair[0]] = pair[1];
            }
        return response;
    }
    public static async Task<System.Text.Json.Nodes.JsonObject> Json(HttpResponseMessage response)
    {
        response.EnsureSuccessStatusCode();
        return (System.Text.Json.Nodes.JsonNode.Parse(await response.Content.ReadAsStringAsync()) as System.Text.Json.Nodes.JsonObject)!;
    }
    public void Dispose() => client.Dispose();
}

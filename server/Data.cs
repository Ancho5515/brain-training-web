using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace BrainTraining.Server;

public sealed class TrainingUser : IdentityUser<Guid>
{
    public Guid DeviceId { get; set; }
    public string DisplayName { get; set; } = "";
    public string NormalizedDisplayName { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}

public sealed class BrowserDevice
{
    public Guid Id { get; set; }
    public string TokenHash { get; set; } = "";
    public string Name { get; set; } = "这台设备";
    public string UserAgent { get; set; } = "";
    public string LastIp { get; set; } = "";
    public DateTime FirstSeenUtc { get; set; }
    public DateTime LastSeenUtc { get; set; }
}

public sealed class TrainingRun
{
    public Guid UserId { get; set; }
    public Guid Id { get; set; }
    public int GameId { get; set; }
    public int Level { get; set; }
    public long Seed { get; set; }
    public double Score { get; set; }
    public double Accuracy { get; set; }
    public long DurationMs { get; set; }
    public string MetricsJson { get; set; } = "{}";
    public DateTime CompletedAtUtc { get; set; }
}

public sealed class BrainDbContext(DbContextOptions<BrainDbContext> options) : IdentityDbContext<TrainingUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<BrowserDevice> Devices => Set<BrowserDevice>();
    public DbSet<TrainingRun> Runs => Set<TrainingRun>();
    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);
        // SQLite stores the UTC value, but not DateTime.Kind; preserve the API's Z suffix.
        configurationBuilder.Properties<DateTime>().HaveConversion<UtcDateTimeConverter>();
    }
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.Entity<BrowserDevice>().HasIndex(x => x.TokenHash).IsUnique();
        builder.Entity<BrowserDevice>().Property(x => x.TokenHash).HasMaxLength(64);
        builder.Entity<BrowserDevice>().Property(x => x.Name).HasMaxLength(80);
        builder.Entity<BrowserDevice>().Property(x => x.UserAgent).HasMaxLength(512);
        builder.Entity<BrowserDevice>().Property(x => x.LastIp).HasMaxLength(64);
        builder.Entity<TrainingUser>().Property(x => x.DisplayName).HasMaxLength(40);
        builder.Entity<TrainingUser>().Property(x => x.NormalizedDisplayName).HasMaxLength(80);
        builder.Entity<TrainingUser>().HasIndex(x => new { x.DeviceId, x.NormalizedDisplayName }).IsUnique();
        builder.Entity<TrainingUser>().HasOne<BrowserDevice>().WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
        builder.Entity<TrainingRun>().HasKey(x => new { x.UserId, x.Id });
        builder.Entity<TrainingRun>().HasIndex(x => new { x.UserId, x.CompletedAtUtc });
        builder.Entity<TrainingRun>().HasOne<TrainingUser>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(value => value, value => DateTime.SpecifyKind(value, DateTimeKind.Utc));

public sealed record AccountDto(Guid Id, string DisplayName);
public sealed record AccountRequest(string? DisplayName, string? Password);
public sealed record LoginRequest(Guid? AccountId, string? Password);
public sealed record DeviceNameRequest(string? Name);
public sealed record PasswordRequest(string? CurrentPassword, string? NewPassword);
public sealed record RunRequest(Guid? Id, int? GameId, int? Level, long? Seed, double? Score, double? Accuracy, long? DurationMs, JsonElement Metrics);
public sealed record RunDto(Guid Id, int GameId, int Level, long Seed, double Score, double Accuracy, long DurationMs, JsonElement Metrics, DateTime CompletedAtUtc);
public sealed record ProgressDto(int GameId, int LastLevel, int HighestLevel, double BestScore, int Plays, DateTime LastPlayedAtUtc);
public sealed record RecordCollection(IReadOnlyList<RunDto> Records, IReadOnlyList<ProgressDto> Progress);

internal static class RecordQueries
{
    public static async Task<RecordCollection> Load(HttpContext context, BrainDbContext db)
    {
        var userId = SessionSecurity.UserId(context);
        var runs = await db.Runs.AsNoTracking().Where(x => x.UserId == userId).OrderByDescending(x => x.CompletedAtUtc).ThenBy(x => x.Id).ToListAsync();
        var records = runs.Select(x => new RunDto(x.Id, x.GameId, x.Level, x.Seed, x.Score, x.Accuracy, x.DurationMs,
            JsonSerializer.Deserialize<JsonElement>(x.MetricsJson), DateTime.SpecifyKind(x.CompletedAtUtc, DateTimeKind.Utc))).ToArray();
        var progress = runs.GroupBy(x => x.GameId).OrderBy(x => x.Key).Select(group => new ProgressDto(group.Key, group.First().Level,
            group.Max(x => x.Level), group.Max(x => x.Score), group.Count(), DateTime.SpecifyKind(group.First().CompletedAtUtc, DateTimeKind.Utc))).ToArray();
        return new(records, progress);
    }
}

internal static class AppVersion
{
    public const string Value = "1.0.0";
}

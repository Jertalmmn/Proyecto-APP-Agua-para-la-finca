using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Data.Sqlite;
using Proyecto_Agua_para_la_Finca.Services;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

var configuredDatabasePath = builder.Configuration["Storage:DatabasePath"] ?? "App_Data/cases.db";
var databasePath = Path.GetFullPath(Path.IsPathRooted(configuredDatabasePath)
    ? configuredDatabasePath
    : Path.Combine(builder.Environment.ContentRootPath, configuredDatabasePath));
var webRootPath = Path.GetFullPath(builder.Environment.WebRootPath
    ?? Path.Combine(builder.Environment.ContentRootPath, "wwwroot"));
var databasePathRelativeToWebRoot = Path.GetRelativePath(webRootPath, databasePath);
if (databasePathRelativeToWebRoot == "."
    || (!Path.IsPathRooted(databasePathRelativeToWebRoot)
        && databasePathRelativeToWebRoot != ".."
        && !databasePathRelativeToWebRoot.StartsWith($"..{Path.DirectorySeparatorChar}", StringComparison.Ordinal)))
{
    throw new InvalidOperationException("The cases database must be stored outside the public web root.");
}

Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
var connectionString = new SqliteConnectionStringBuilder
{
    DataSource = databasePath,
    Mode = SqliteOpenMode.ReadWriteCreate,
    DefaultTimeout = 5
}.ToString();
var casesRepository = new CasesRepository(connectionString);
await casesRepository.InitializeAsync();
builder.Services.AddSingleton(casesRepository);

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "CosechaLluvia.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.IsEssential = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseDefaultFiles();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/auth/session", (ClaimsPrincipal user) =>
    user.Identity?.IsAuthenticated == true
        ? Results.Ok(new { authenticated = true, username = user.Identity.Name })
        : Results.Ok(new { authenticated = false, username = (string?)null }));

app.MapPost("/api/auth/login", async (
    LoginRequest request,
    HttpContext context,
    IWebHostEnvironment environment,
    IConfiguration configuration) =>
{
    var username = request.Usuario?.Trim();
    if (string.IsNullOrEmpty(username) || string.IsNullOrEmpty(request.Contrasena))
    {
        return Results.Unauthorized();
    }

    var expectedUsername = environment.IsDevelopment()
        ? "admin"
        : configuration["Authentication:Username"];
    var expectedPassword = environment.IsDevelopment()
        ? "admin"
        : configuration["Authentication:Password"];
    if (string.IsNullOrWhiteSpace(expectedUsername) || string.IsNullOrEmpty(expectedPassword))
    {
        return Results.Problem(
            title: "Authentication is not configured for this environment.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }

    if (!FixedTimeEquals(username, expectedUsername)
        || !FixedTimeEquals(request.Contrasena, expectedPassword))
    {
        return Results.Unauthorized();
    }

    var identity = new ClaimsIdentity(
        [new Claim(ClaimTypes.Name, username)],
        CookieAuthenticationDefaults.AuthenticationScheme);
    await context.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        new ClaimsPrincipal(identity),
        new AuthenticationProperties { IsPersistent = false, AllowRefresh = true });

    return Results.Ok(new { username });
});

app.MapPost("/api/auth/logout", async (HttpContext context) =>
{
    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.NoContent();
}).RequireAuthorization();

app.MapGet("/api/cases", async (CasesRepository repository) =>
    Results.Ok(await repository.GetAllAsync()))
    .RequireAuthorization();

app.MapPost("/api/cases", async (SaveCaseRequest request, CasesRepository repository) =>
{
    var name = request.Nombre?.Trim();
    if (string.IsNullOrWhiteSpace(name) || name.Length > 120)
    {
        return Results.BadRequest(new { message = "El nombre del caso debe tener entre 1 y 120 caracteres." });
    }

    if (request.Params.ValueKind != System.Text.Json.JsonValueKind.Object
        || request.Params.GetRawText().Length > 256_000)
    {
        return Results.BadRequest(new { message = "Los parámetros del caso no tienen un formato válido." });
    }

    var dateLabel = string.IsNullOrWhiteSpace(request.Fecha)
        ? DateTime.UtcNow.ToString("yyyy-MM-dd")
        : request.Fecha.Trim();
    if (dateLabel.Length > 32)
    {
        return Results.BadRequest(new { message = "La fecha del caso no tiene un formato válido." });
    }

    return Results.Ok(await repository.SaveAsync(name, dateLabel, request.Params));
}).RequireAuthorization();

app.MapDelete("/api/cases/{id}", async (string id, CasesRepository repository) =>
{
    if (!Guid.TryParseExact(id, "N", out _))
    {
        return Results.BadRequest(new { message = "El identificador del caso no es válido." });
    }

    return await repository.DeleteAsync(id)
        ? Results.NoContent()
        : Results.NotFound();
}).RequireAuthorization();

app.Run();

static bool FixedTimeEquals(string candidate, string expected)
{
    var candidateBytes = Encoding.UTF8.GetBytes(candidate);
    var expectedBytes = Encoding.UTF8.GetBytes(expected);
    return candidateBytes.Length == expectedBytes.Length
        && CryptographicOperations.FixedTimeEquals(candidateBytes, expectedBytes);
}
using Microsoft.Data.Sqlite;
using System.Text.Json;

namespace Proyecto_Agua_para_la_Finca.Services;

public sealed class CasesRepository(string connectionString)
{
    public async Task InitializeAsync()
    {
        await using var connection = await OpenConnectionAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS cases (
                id TEXT NOT NULL PRIMARY KEY,
                name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                date_label TEXT NOT NULL,
                params_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_cases_updated_at ON cases (updated_at DESC);
            """;
        await command.ExecuteNonQueryAsync();
    }

    public async Task<IReadOnlyList<SavedCase>> GetAllAsync()
    {
        await using var connection = await OpenConnectionAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, name, date_label, params_json
            FROM cases
            ORDER BY updated_at DESC, name COLLATE NOCASE;
            """;

        await using var reader = await command.ExecuteReaderAsync();
        var cases = new List<SavedCase>();
        while (await reader.ReadAsync())
        {
            cases.Add(ReadCase(reader));
        }

        return cases;
    }

    public async Task<SavedCase> SaveAsync(string name, string dateLabel, JsonElement parameters)
    {
        var now = DateTimeOffset.UtcNow.ToString("O");
        var id = Guid.NewGuid().ToString("N");
        await using var connection = await OpenConnectionAsync();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                INSERT INTO cases (id, name, date_label, params_json, created_at, updated_at)
                VALUES ($id, $name, $date, $params, $now, $now)
                ON CONFLICT(name) DO UPDATE SET
                    name = excluded.name,
                    date_label = excluded.date_label,
                    params_json = excluded.params_json,
                    updated_at = excluded.updated_at;
                """;
            command.Parameters.AddWithValue("$id", id);
            command.Parameters.AddWithValue("$name", name);
            command.Parameters.AddWithValue("$date", dateLabel);
            command.Parameters.AddWithValue("$params", parameters.GetRawText());
            command.Parameters.AddWithValue("$now", now);
            await command.ExecuteNonQueryAsync();
        }

        await using var readCommand = connection.CreateCommand();
        readCommand.CommandText = """
            SELECT id, name, date_label, params_json
            FROM cases
            WHERE name = $name;
            """;
        readCommand.Parameters.AddWithValue("$name", name);
        await using var reader = await readCommand.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
        {
            throw new InvalidOperationException("The saved case could not be read back.");
        }

        return ReadCase(reader);
    }

    public async Task<bool> DeleteAsync(string id)
    {
        await using var connection = await OpenConnectionAsync();
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM cases WHERE id = $id;";
        command.Parameters.AddWithValue("$id", id);
        return await command.ExecuteNonQueryAsync() > 0;
    }

    private async Task<SqliteConnection> OpenConnectionAsync()
    {
        var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        return connection;
    }

    private static SavedCase ReadCase(SqliteDataReader reader)
    {
        using var document = JsonDocument.Parse(reader.GetString(3));
        return new SavedCase(
            reader.GetString(0),
            reader.GetString(1),
            reader.GetString(2),
            document.RootElement.Clone());
    }
}

public sealed record SavedCase(string Id, string Nombre, string Fecha, JsonElement Params);

public sealed record SaveCaseRequest(string? Nombre, string? Fecha, JsonElement Params);

public sealed record LoginRequest(string? Usuario, string? Contrasena);

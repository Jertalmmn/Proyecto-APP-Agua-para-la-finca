FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copia absolutamente todos los archivos y carpetas
COPY . .

# Compila el proyecto directamente
RUN dotnet publish "Proyecto Agua para la Finca.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "Proyecto Agua para la Finca.dll"]
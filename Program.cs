var builder = WebApplication.CreateBuilder(args);

// 1. Configuration des services (l'équivalent de la boîte à outils du serveur)
builder.Services.AddCors(); // Indispensable pour que ton React puisse lui parler plus tard !

var app = builder.Build();

// 2. Configuration du pipeline HTTP (la sécurité et les routes)
app.UseCors(policy => policy
    .AllowAnyOrigin()
    .AllowAnyMethod()
    .AllowAnyHeader());

// Notre route Hello World !
app.MapGet("/api/hello", () => new { message = "Hello World!" });

app.Run();
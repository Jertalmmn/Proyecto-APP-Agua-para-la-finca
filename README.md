# Proyecto-APP-Agua-para-la-finca

## Ejecutar en desarrollo

Ejecuta `dotnet run` desde la carpeta del proyecto. En el entorno `Development`, la pantalla de acceso usa `admin` como usuario y contraseña; esta credencial es solo para pruebas.

## Casos y almacenamiento

Los casos se guardan en SQLite en el servidor y se comparten entre todos los funcionarios autenticados. Guardar otro caso con el mismo nombre (sin distinguir mayúsculas) actualiza el existente. La ruta predeterminada es `App_Data/cases.db` y se puede cambiar con `Storage__DatabasePath`. El host debe conservar y respaldar ese archivo en un volumen persistente para no perder los casos.

## Despliegue

En `Production`, no hay credenciales predeterminadas. Configura `Authentication__Username` y `Authentication__Password` mediante secretos del entorno y sirve la aplicación exclusivamente por HTTPS. Configura `Storage__DatabasePath` para apuntar a un volumen persistente fuera de `wwwroot`.
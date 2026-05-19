export function GET() {
  return Response.json({
    status: "ok",
    version: "1.0.0",
    codename: "Hermes",
    service: "purpleiris-web",
  });
}

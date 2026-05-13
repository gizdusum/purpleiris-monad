export function GET() {
  return Response.json({ status: "ok", version: "2.0.0", service: "purpleiris-web" });
}

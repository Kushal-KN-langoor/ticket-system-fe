export async function POST(request: Request) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  const refreshToken = request.headers.get("x-refresh-token");

  if (!refreshToken) {
    return Response.json({ message: "Missing refresh token." }, { status: 401 });
  }

  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-refresh-token": refreshToken,
    },
  });

  const data = await response.json();

  return Response.json(data, { status: response.status });
}

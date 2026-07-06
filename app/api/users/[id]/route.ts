export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const baseUrl = process.env.BASE_URL;
  const { id } = await params;

  const response = await fetch(`${baseUrl}/users/${id}/dashboard`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-auth-token': request.headers.get('x-auth-token') || '',
    },
  });

  const data = await response.json();

  return Response.json(data, { status: response.status });
}
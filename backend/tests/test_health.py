from httpx import AsyncClient


async def test_liveness(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


async def test_request_id_is_returned(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/live", headers={"X-Request-ID": "abc-123"})
    assert response.headers["x-request-id"] == "abc-123"


async def test_request_id_is_generated(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health/live")
    assert len(response.headers["x-request-id"]) == 32


async def test_root_health_reports_db(client: AsyncClient) -> None:
    response = await client.get("/health")
    assert response.status_code in (200, 503)
    assert response.json()["db"] in ("connected", "disconnected")

import json
import os
import uuid
from pathlib import Path

from fastapi import Header, HTTPException
from pydantic import BaseModel
from google.adk.cli.fast_api import get_fast_api_app
from google.adk.runners import InMemoryRunner
from google.genai import types

from .agent import app as agent_app

AGENTS_DIR = str(Path(__file__).resolve().parent.parent)
app = get_fast_api_app(agents_dir=AGENTS_DIR, web=False)
runner = InMemoryRunner(app=agent_app)


class AnalyzeRequest(BaseModel):
    memo: str
    centralContext: str
    validSourceIds: list[str] = []


def _extract_json(text: str) -> dict:
    value = (text or "").strip()
    if value.startswith("```json"):
        value = value[7:]
    elif value.startswith("```"):
        value = value[3:]
    if value.endswith("```"):
        value = value[:-3]
    return json.loads(value.strip())


@app.post("/teamgrit/analyze")
async def analyze_work(
    payload: AnalyzeRequest,
    authorization: str | None = Header(default=None),
):
    expected = os.getenv("TEAMGRIT_AGENT_SHARED_SECRET", "").strip()
    if expected and authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="unauthorized")

    prompt = f"""[USER_MEMO]\n{payload.memo}\n\n[CENTRAL_CONTEXT]\n{payload.centralContext}\n\n[VALID_SOURCE_IDS]\n{json.dumps(payload.validSourceIds, ensure_ascii=False)}"""
    user_id = "teamgrit-ops"
    session = await runner.session_service.create_session(
        app_name=agent_app.name,
        user_id=user_id,
        session_id=f"work-{uuid.uuid4().hex}",
    )
    chunks: list[str] = []
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)],
        ),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if getattr(part, "text", None):
                    chunks.append(part.text)

    result = _extract_json("".join(chunks))
    result.setdefault("tasks", [])
    result.setdefault("trace", {})
    result["modelUsed"] = os.getenv("TEAMGRIT_AGENT_MODEL", "gemini-3.8-flash")
    result["runtime"] = "google-adk"
    return result

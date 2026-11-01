from typing import Literal, Optional
from pydantic import BaseModel, Field


class ChatLocation(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1200)


class AIChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=1200)
    conversation_id: Optional[str] = Field(default=None, max_length=100)
    location: Optional[ChatLocation] = None
    context: list[ChatTurn] = Field(default_factory=list, max_length=8)


class AISource(BaseModel):
    type: Literal["project", "issue", "department", "locality", "statistics"]
    id: int
    code: Optional[str] = None
    title: str


class AIChatOut(BaseModel):
    conversation_id: str
    answer: str
    sources: list[AISource]
    suggested_questions: list[str]

from typing import Optional
from pydantic import BaseModel, Field, StringConstraints
from typing import Annotated

class MediaAttachmentRef(BaseModel):
    media_id: int = Field(gt=0)
    upload_token: Annotated[str, StringConstraints(min_length=32, max_length=128)]

class IssueIn(BaseModel):
    project_id: Optional[int] = None
    kind: str
    department: Optional[str] = None
    message: str
    phone: Optional[str] = None
    email: Optional[str] = None
    severity: Optional[str] = 'Normal'
    locality: Optional[str] = 'Chennai'
    pincode: Optional[str] = None
    is_question: Optional[bool] = False
    intimated_in_advance: Optional[bool] = False
    attachments: list[MediaAttachmentRef] = Field(default_factory=list, max_length=5)

class IssueReplyIn(BaseModel):
    reply: str
    status: str = 'Resolved'

class QuestionIn(BaseModel):
    project_id: int
    message: str
    phone: Optional[str] = None
    email: Optional[str] = None

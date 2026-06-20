from pydantic import BaseModel


class StationResponse(BaseModel):
    id: int
    name: str
    municipality: str
    line_id: int
    line_name: str

    model_config = {"from_attributes": True}


class LineResponse(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}

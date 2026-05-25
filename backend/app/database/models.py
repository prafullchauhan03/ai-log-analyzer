from sqlalchemy import Column, Integer, String, DateTime, Float, Text
from sqlalchemy.sql import func
from app.database.database import Base


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String, unique=True, index=True)
    email           = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role            = Column(String, default="user")
    created_at      = Column(DateTime(timezone=True), server_default=func.now())


class Alert(Base):
    __tablename__ = "alerts"

    id              = Column(Integer, primary_key=True, index=True)
    title           = Column(String,  nullable=False)
    message         = Column(Text,    nullable=False)
    severity        = Column(String,  nullable=False)   # critical | high | medium | low
    category        = Column(String,  nullable=False)   # security | performance | infrastructure | anomaly
    source          = Column(String,  nullable=False)   # elasticsearch | kafka | redis | system | ai
    rule_id         = Column(String,  nullable=True)
    metric_key      = Column(String,  nullable=True)
    metric_value    = Column(Float,   nullable=True)
    threshold       = Column(Float,   nullable=True)
    status          = Column(String,  default="open")   # open | acknowledged | resolved
    acknowledged_by = Column(String,  nullable=True)
    resolved_by     = Column(String,  nullable=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

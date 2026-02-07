from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3, time, os

DB_PATH = os.path.join(os.path.dirname(__file__), "leaderboard.db")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            score INTEGER NOT NULL,
            death_x REAL DEFAULT 0,
            ts REAL NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

class ScoreSubmit(BaseModel):
    name: str = "AAA"
    score: int = 0
    deathX: float = 0

@app.get("/lb")
def get_leaderboard():
    conn = get_db()
    rows = conn.execute("SELECT name, score, ts FROM scores ORDER BY score DESC LIMIT 50").fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/lb")
def submit_score(body: ScoreSubmit):
    name = (body.name or "AAA").strip()[:12] or "AAA"
    sc = max(0, body.score)
    now = time.time() * 1000
    conn = get_db()
    conn.execute("INSERT INTO scores (name, score, death_x, ts) VALUES (?, ?, ?, ?)", (name, sc, body.deathX, now))
    conn.commit()
    rank = conn.execute("SELECT COUNT(*) FROM scores WHERE score > ?", (sc,)).fetchone()[0] + 1
    total = conn.execute("SELECT COUNT(*) FROM scores").fetchone()[0]
    conn.close()
    return {"ok": True, "rank": rank, "total": total}

@app.get("/deaths")
def get_deaths():
    conn = get_db()
    rows = conn.execute("SELECT name, score, death_x as x, ts FROM scores WHERE death_x > 0 ORDER BY ts DESC LIMIT 200").fetchall()
    conn.close()
    return [dict(r) for r in rows]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)

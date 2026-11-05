---
runs: 2
max_turns: 8
allowed_tools: Read, Glob, Grep, Bash, Skill, Agent
tags: [engineering, positive, security]
---

Please do a security review of this FastAPI snippet before we ship it:

```python
@app.get("/reports/{report_id}")
async def get_report(report_id: int, user=Depends(current_user)):
    return await db.fetchrow(f"select * from reports where id = {report_id}")

@app.post("/import")
async def import_url(url: str):
    r = requests.get(url)
    return {"size": len(r.content)}
```

"""Canvas layout lives in its own small file.

Dragging a card is the most frequent write in the app. Keeping the layout next to
the project meant rewriting every megabyte of media for a two-pixel move, so it now
has its own file keyed by project id. The project payload still carries a copy for
export and for projects created before this file existed; this file wins on load.
"""
import json
from pathlib import Path

NAME = 'layout.json'
# Every entry is a few kilobytes, so the cap only exists to keep the file from
# growing forever. It used to be 60, which real workbenches reach.
LIMIT = 200


def _path(data):
    return Path(data) / NAME


def all(data):
    try:
        value = json.loads(_path(data).read_text('utf-8'))
        projects = value.get('projects')
        return projects if isinstance(projects, dict) else {}
    except Exception:
        return {}


def write(data, project_id, layout):
    projects = all(data)
    key = str(project_id)
    # Re-insert instead of overwriting in place: a dict keeps its original position
    # on assignment, so the old code evicted whichever project was created first
    # rather than the one nobody had touched, and silently dropped its card layout.
    projects.pop(key, None)
    projects[key] = layout if isinstance(layout, dict) else {}
    if len(projects) > LIMIT:
        for stale in list(projects)[:len(projects) - LIMIT]:
            projects.pop(stale, None)
    path = _path(data)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps({'version': 1, 'projects': projects}, ensure_ascii=False), 'utf-8')
    temp.replace(path)


def apply(project, data):
    """Overlay the stored layout for this project, if any."""
    if not isinstance(project, dict):
        return project
    layout = all(data).get(str(project.get('projectId')))
    if isinstance(layout, dict):
        project['overviewLayout'] = layout
    return project

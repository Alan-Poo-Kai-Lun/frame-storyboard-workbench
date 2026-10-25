"""Canvas layout lives in its own small file.

Dragging a card is the most frequent write in the app. Keeping the layout next to
the project meant rewriting every megabyte of media for a two-pixel move, so it now
has its own file keyed by project id. The project payload still carries a copy for
export and for projects created before this file existed; this file wins on load.
"""
import json
from pathlib import Path

NAME = 'layout.json'
LIMIT = 60


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
    projects[str(project_id)] = layout if isinstance(layout, dict) else {}
    if len(projects) > LIMIT:
        for key in list(projects)[:len(projects) - LIMIT]:
            projects.pop(key, None)
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

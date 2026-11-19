"""Basic tracked-file checks; not a replacement for GitHub secret scanning."""
import re, subprocess, pathlib
patterns=[r'sk-proj-[A-Za-z0-9_-]{20,}',r'ghp_[A-Za-z0-9]{30,}',r'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----']
fail=[]
for name in subprocess.check_output(['git','ls-files'],text=True).splitlines():
 p=pathlib.Path(name)
 if p.suffix in ['.webp','.png','.npz']:continue
 for pattern in patterns:
  if re.search(pattern,p.read_text(errors='replace')):fail.append(name)
if fail:raise SystemExit('Potential credentials in: '+', '.join(set(fail)))
print('No configured secret patterns found in tracked files; limited heuristic scan.')

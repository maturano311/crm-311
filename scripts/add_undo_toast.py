import os

path = os.path.join(os.path.dirname(__file__), '..', 'src', 'app', 'rota', 'page.tsx')
path = os.path.normpath(path)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The last thing before </div></);>}
MARKER = "      )}\n    </div>\n  );\n}\n"

TOAST = """      )}

      {/* Toast de desfazer visita */}
      {ultimaConfirmada && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-emerald-950 border border-emerald-500/50 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-emerald-900/50">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-emerald-400 truncate">Visita confirmada!</p>
              <p className="text-xs text-emerald-600 truncate">{ultimaConfirmada.nome_fantasia}</p>
            </div>
            <button
              onClick={handleDesfazerVisita}
              disabled={desfazendoId !== null}
              className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-400 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {desfazendoId !== null ? '...' : 'Desfazer'}
            </button>
            <button
              onClick={() => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); setUltimaConfirmada(null); }}
              className="p-1 text-emerald-600 hover:text-emerald-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
"""

if MARKER in content:
    content = content.replace(MARKER, TOAST, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("SUCCESS: undo toast added")
else:
    # Try finding the pattern with different line endings
    lines = content.splitlines()
    for i, line in enumerate(lines[-10:], start=len(lines)-10):
        print(f"  line {i}: {repr(line)}")
    print("MARKER NOT FOUND")

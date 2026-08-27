# Auto-reload modules and set some common display prefs
try:
    from IPython import get_ipython
    ip = get_ipython()
    if ip:
        ip.run_line_magic("load_ext", "autoreload")
        ip.run_line_magic("autoreload", "2")
        ip.run_line_magic("config", "Completer.use_jedi = False")
        # Inline plots if matplotlib is present
        try:
            ip.run_line_magic("matplotlib", "inline")
        except Exception:
            pass
except Exception:
    pass

# Optional: pandas display tweaks
try:
    import pandas as pd
    pd.set_option("display.max_columns", 200)
    pd.set_option("display.width", 120)
except Exception:
    pass

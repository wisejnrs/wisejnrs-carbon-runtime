# Minimal Jupyter Server config; token auth remains enabled by default
c = get_config()  # noqa
c.ServerApp.ip = "0.0.0.0"
c.ServerApp.port = 8888
c.ServerApp.open_browser = False
c.ServerApp.allow_origin = "*"
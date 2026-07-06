module.exports = {
  apps: [
    {
      name: "baharat-otomasyon",
      script: "/opt/baharat_venv/bin/gunicorn",
      args: "--bind 127.0.0.1:5000 --workers 1 --threads 4 app:app",
      cwd: "/opt/baharat otomasyon",
      interpreter: "none",
      env: {
        PYTHONPATH: "/opt/baharat otomasyon"
      }
    }
  ]
};

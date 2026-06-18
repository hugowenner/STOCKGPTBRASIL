#!/bin/bash
cd /home/z/my-project/stock-api
exec python3 -m uvicorn main:app --host 0.0.0.0 --port 3030

# deteragent_config.py
import os, time
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OG_PRIVATE_KEY = os.getenv("OG_PRIVATE_KEY")

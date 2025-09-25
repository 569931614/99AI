import json
from bailing.stardust_client import StardustClient

if __name__ == "__main__":
    key = "lm-8K119Z4+HPCiRPtj5XyXgg=="
    client = StardustClient(api_key=key)
    resp = client.chat(
        messages=[{"role": "user", "content": "你好，做个自我介绍"}],
        bot_name="测试助手",
        bot_content="你是一个友好的中文助手。",
        stream=False,
        timeout=60,
    )
    print(json.dumps(resp, ensure_ascii=False))


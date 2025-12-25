import pickle
import json
import os
from pathlib import Path

# 경로 설정
# data_path = Path("c:/NAIS/data/tag_cache.pkl")
# core/tag_data_manager.py가 참조하는 실제 경로는 상위 폴더 data
# c:\NAIS\data\tag_cache.pkl

data_path = Path(r"c:\NAIS\data\tag_cache.pkl")
output_path = Path(r"c:\NAIS\NAIS2\src\assets\tags.json")

print(f"Looking for data at: {data_path}")

if not data_path.exists():
    print(f"Error: {data_path} not found.")
    # 더미 데이터 생성 (테스트용)
    dummy_tags = [
        {"label": "1girl", "value": "1girl", "count": 99999, "type": "general"},
        {"label": "solo", "value": "solo", "count": 88888, "type": "general"},
        {"label": "long hair", "value": "long hair", "count": 77777, "type": "general"},
        {"label": "blue eyes", "value": "blue eyes", "count": 66666, "type": "general"},
        {"label": "school uniform", "value": "school uniform", "count": 55555, "type": "general"},
        {"label": "artist:wd", "value": "artist:wd", "count": 44444, "type": "artist"},
        {"label": "character:miku", "value": "character:miku", "count": 33333, "type": "character"}
    ]
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(dummy_tags, f, ensure_ascii=False)
    print(f"Created dummy tags at {output_path} because source was missing.")
    exit(0)

try:
    with open(data_path, 'rb') as f:
        data = pickle.load(f)
        
    tags = []
    
    # General
    # data['limited_generals']는 { 'tag': count, ... }
    for tag, count in data.get('limited_generals', {}).items():
        tags.append({"label": tag, "value": tag, "count": count, "type": "general"})
        
    # Artist
    for tag, count in data.get('artist_dict', {}).items():
        tags.append({"label": tag, "value": tag, "count": count, "type": "artist"})
        
    # Character
    for tag, count in data.get('character_dict_count', {}).items():
        tags.append({"label": tag, "value": tag, "count": count, "type": "character"})

    # Copyright
    for tag, count in data.get('copyright_dict', {}).items():
        tags.append({"label": tag, "value": tag, "count": count, "type": "copyright"})
        
    # 빈도순 정렬
    tags.sort(key=lambda x: x['count'], reverse=True)
    
    # 상위 30만개 저장 (성능과 커버리지 타협)
    tags = tags[:300000]
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(tags, f, ensure_ascii=False)
        
    print(f"Success: Saved {len(tags)} tags to {output_path}")
    
except Exception as e:
    print(f"Error processing pickle: {e}")
    exit(1)

import pandas as pd
import joblib
import json
import os
from sklearn.ensemble import RandomForestClassifier

def train_model():
    try:
        input_csv = 'data_training_ai.csv'
        if not os.path.exists(input_csv):
            print(json.dumps({"success": False, "error": f"Không tìm thấy file {input_csv}"}))
            return

        df = pd.read_csv(input_csv)
        
        # Đồng bộ tập tính năng 5 cột tương thích với file data_training_ai.csv 85MB của bạn
        features = ['So', 'Gap', 'Freq_10', 'Freq_30', 'Was_Last']
        target_col = 'Target' if 'Target' in df.columns else 'Label'

        if target_col not in df.columns:
            print(json.dumps({"success": False, "error": f"Không tìm thấy cột nhãn trong file dữ liệu."}))
            return

        model = RandomForestClassifier(
            n_estimators=150, 
            max_depth=15, 
            min_samples_leaf=3, 
            class_weight='balanced', 
            random_state=42, 
            n_jobs=-1
        )
        
        model.fit(df[features], df[target_col])
        
        model_name = 'model_xsmn_predict.pkl'
        joblib.dump(model, model_name, compress=3)
        
        print(json.dumps({
            "success": True,
            "message": "Huấn luyện mô hình thành công!",
            "used_features": features,
            "file_size_mb": round(os.path.getsize(model_name) / (1024 * 1024), 2)
        }, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    train_model()
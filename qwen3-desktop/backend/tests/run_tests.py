#!/usr/bin/env python3
"""
Qwen 3 Desktop Assistant 테스트 실행 스크립트
"""

import subprocess
import sys
import os
import argparse
from pathlib import Path

def run_command(command, description):
    """명령어 실행"""
    print(f"\n{'='*50}")
    print(f"🚀 {description}")
    print(f"{'='*50}")
    
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print("✅ 성공!")
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print("❌ 실패!")
        print(f"에러: {e}")
        if e.stdout:
            print(f"출력: {e.stdout}")
        if e.stderr:
            print(f"에러 출력: {e.stderr}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Qwen 3 Desktop Assistant 테스트 실행")
    parser.add_argument("--type", choices=["unit", "integration", "performance", "all"], 
                       default="all", help="테스트 타입")
    parser.add_argument("--coverage", action="store_true", help="코드 커버리지 포함")
    parser.add_argument("--verbose", action="store_true", help="상세 출력")
    parser.add_argument("--parallel", action="store_true", help="병렬 실행")
    
    args = parser.parse_args()
    
    # 프로젝트 루트로 이동
    project_root = Path(__file__).parent.parent
    os.chdir(project_root)
    
    print("🧪 Qwen 3 Desktop Assistant 테스트 실행")
    print(f"📁 작업 디렉토리: {os.getcwd()}")
    
    # 의존성 설치 확인
    if not run_command("pip list | grep pytest", "테스트 의존성 확인"):
        print("📦 테스트 의존성 설치 중...")
        if not run_command("pip install -r requirements-test.txt", "테스트 의존성 설치"):
            print("❌ 의존성 설치 실패!")
            return 1
    
    # 테스트 명령어 구성
    test_cmd = "pytest"
    
    if args.verbose:
        test_cmd += " -v"
    
    if args.coverage:
        test_cmd += " --cov=app --cov-report=html --cov-report=term-missing"
    
    if args.parallel:
        test_cmd += " -n auto"
    
    # 테스트 타입별 실행
    if args.type == "unit":
        test_cmd += " -m unit"
    elif args.type == "integration":
        test_cmd += " -m integration"
    elif args.type == "performance":
        test_cmd += " -m performance"
    
    # 테스트 실행
    success = run_command(test_cmd, f"{args.type.title()} 테스트 실행")
    
    if success:
        print("\n🎉 모든 테스트가 성공적으로 완료되었습니다!")
        
        if args.coverage:
            print("\n📊 커버리지 리포트가 htmlcov/index.html에 생성되었습니다.")
        
        return 0
    else:
        print("\n💥 일부 테스트가 실패했습니다.")
        return 1

if __name__ == "__main__":
    sys.exit(main())

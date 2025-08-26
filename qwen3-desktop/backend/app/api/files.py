from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import os
import shutil
from pathlib import Path
import aiofiles
import magic

from ..config import settings
from ..utils.logger import api_logger

router = APIRouter()

class FileInfo(BaseModel):
    filename: str
    size: int
    content_type: str
    path: str
    uploaded_at: str

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = None
) -> Dict[str, Any]:
    """파일을 업로드합니다."""
    try:
        # 파일 크기 검증
        if file.size and file.size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds maximum allowed size of {settings.MAX_FILE_SIZE} bytes"
            )
        
        # 파일 타입 검증
        content = await file.read()
        file_type = magic.from_buffer(content, mime=True)
        
        if file_type not in settings.ALLOWED_FILE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file_type} is not allowed"
            )
        
        # 업로드 디렉토리 생성
        upload_dir = Path(settings.UPLOAD_DIR)
        if conversation_id:
            upload_dir = upload_dir / conversation_id
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        # 파일 저장
        file_path = upload_dir / file.filename
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        api_logger.info(f"File uploaded: {file_path}")
        
        return {
            "filename": file.filename,
            "size": len(content),
            "content_type": file_type,
            "path": str(file_path),
            "conversation_id": conversation_id
        }
        
    except Exception as e:
        api_logger.error(f"File upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_files(
    conversation_id: Optional[str] = None,
    limit: int = 100
) -> List[FileInfo]:
    """업로드된 파일 목록을 반환합니다."""
    try:
        upload_dir = Path(settings.UPLOAD_DIR)
        if conversation_id:
            upload_dir = upload_dir / conversation_id
        
        if not upload_dir.exists():
            return []
        
        files = []
        for file_path in upload_dir.iterdir():
            if file_path.is_file():
                stat = file_path.stat()
                files.append(FileInfo(
                    filename=file_path.name,
                    size=stat.st_size,
                    content_type=magic.from_file(str(file_path), mime=True),
                    path=str(file_path),
                    uploaded_at=str(stat.st_mtime)
                ))
        
        # 최신 파일부터 정렬
        files.sort(key=lambda x: x.uploaded_at, reverse=True)
        
        return files[:limit]
        
    except Exception as e:
        api_logger.error(f"File listing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{filename}")
async def download_file(
    filename: str,
    conversation_id: Optional[str] = None
):
    """파일을 다운로드합니다."""
    try:
        upload_dir = Path(settings.UPLOAD_DIR)
        if conversation_id:
            upload_dir = upload_dir / conversation_id
        
        file_path = upload_dir / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type=magic.from_file(str(file_path), mime=True)
        )
        
    except Exception as e:
        api_logger.error(f"File download failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{filename}")
async def delete_file(
    filename: str,
    conversation_id: Optional[str] = None
) -> Dict[str, str]:
    """파일을 삭제합니다."""
    try:
        upload_dir = Path(settings.UPLOAD_DIR)
        if conversation_id:
            upload_dir = upload_dir / conversation_id
        
        file_path = upload_dir / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        file_path.unlink()
        api_logger.info(f"File deleted: {file_path}")
        
        return {"message": f"File {filename} deleted successfully"}
        
    except Exception as e:
        api_logger.error(f"File deletion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/info/{filename}")
async def get_file_info(
    filename: str,
    conversation_id: Optional[str] = None
) -> FileInfo:
    """파일 정보를 반환합니다."""
    try:
        upload_dir = Path(settings.UPLOAD_DIR)
        if conversation_id:
            upload_dir = upload_dir / conversation_id
        
        file_path = upload_dir / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        stat = file_path.stat()
        
        return FileInfo(
            filename=file_path.name,
            size=stat.st_size,
            content_type=magic.from_file(str(file_path), mime=True),
            path=str(file_path),
            uploaded_at=str(stat.st_mtime)
        )
        
    except Exception as e:
        api_logger.error(f"File info retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/analyze")
async def analyze_file(
    filename: str,
    conversation_id: Optional[str] = None
) -> Dict[str, Any]:
    """파일 내용을 분석합니다."""
    try:
        upload_dir = Path(settings.UPLOAD_DIR)
        if conversation_id:
            upload_dir = upload_dir / conversation_id
        
        file_path = upload_dir / filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # 파일 타입별 분석
        content_type = magic.from_file(str(file_path), mime=True)
        
        if content_type.startswith('text/'):
            # 텍스트 파일 분석
            async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                content = await f.read()
            
            return {
                "filename": filename,
                "content_type": content_type,
                "size": len(content),
                "line_count": len(content.splitlines()),
                "word_count": len(content.split()),
                "preview": content[:1000] + "..." if len(content) > 1000 else content
            }
        
        elif content_type.startswith('image/'):
            # 이미지 파일 분석
            from PIL import Image
            
            with Image.open(file_path) as img:
                return {
                    "filename": filename,
                    "content_type": content_type,
                    "size": file_path.stat().st_size,
                    "width": img.width,
                    "height": img.height,
                    "mode": img.mode,
                    "format": img.format
                }
        
        else:
            # 기타 파일 타입
            return {
                "filename": filename,
                "content_type": content_type,
                "size": file_path.stat().st_size,
                "message": "File type not supported for analysis"
            }
        
    except Exception as e:
        api_logger.error(f"File analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

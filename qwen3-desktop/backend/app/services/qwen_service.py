import asyncio
import json
from typing import AsyncGenerator, Dict, Any, Optional, List
from pathlib import Path
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from ..config import settings
from ..utils.logger import qwen_logger

class QwenService:
    def __init__(self):
        self.model = None
        self.tokenizer = None
        self.device = None
        self.is_initialized = False
        self.conversation_history: Dict[str, List[Dict[str, str]]] = {}
        
    async def initialize(self):
        """Qwen 모델을 초기화합니다."""
        try:
            qwen_logger.info("Initializing Qwen model...")
            
            # 디바이스 설정
            if settings.QWEN_DEVICE == "auto":
                if torch.cuda.is_available():
                    self.device = "cuda"
                elif torch.backends.mps.is_available():
                    self.device = "mps"
                else:
                    self.device = "cpu"
            else:
                self.device = settings.QWEN_DEVICE
            
            qwen_logger.info(f"Using device: {self.device}")
            
            # 모델 경로 설정
            model_path = settings.QWEN_MODEL_PATH or settings.QWEN_MODEL_NAME
            
            # 토크나이저 로딩
            qwen_logger.info("Loading tokenizer...")
            self.tokenizer = AutoTokenizer.from_pretrained(
                model_path,
                trust_remote_code=True,
                use_fast=False
            )
            
            # 패딩 토큰 설정
            if self.tokenizer.pad_token is None:
                self.tokenizer.pad_token = self.tokenizer.eos_token
            
            # 모델 로딩
            qwen_logger.info("Loading model...")
            self.model = AutoModelForCausalLM.from_pretrained(
                model_path,
                torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
                device_map="auto" if self.device == "cuda" else None,
                trust_remote_code=True,
                low_cpu_mem_usage=True
            )
            
            if self.device != "cuda":
                self.model = self.model.to(self.device)
            
            self.is_initialized = True
            qwen_logger.info("Qwen model initialized successfully")
            
        except Exception as e:
            qwen_logger.error(f"Failed to initialize Qwen model: {e}")
            raise
    
    async def cleanup(self):
        """리소스를 정리합니다."""
        try:
            if self.model:
                del self.model
            if self.tokenizer:
                del self.tokenizer
            
            # GPU 메모리 정리
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            self.is_initialized = False
            qwen_logger.info("Qwen service cleaned up")
            
        except Exception as e:
            qwen_logger.error(f"Error during cleanup: {e}")
    
    def _format_conversation(self, conversation_id: str, user_message: str) -> str:
        """대화를 Qwen 형식으로 포맷팅합니다."""
        if conversation_id not in self.conversation_history:
            self.conversation_history[conversation_id] = []
        
        # 대화 히스토리 추가
        self.conversation_history[conversation_id].append({
            "role": "user",
            "content": user_message
        })
        
        # Qwen 형식으로 변환
        formatted_messages = []
        for msg in self.conversation_history[conversation_id]:
            if msg["role"] == "user":
                formatted_messages.append(f"<|im_start|>user\n{msg['content']}<|im_end|>")
            elif msg["role"] == "assistant":
                formatted_messages.append(f"<|im_start|>assistant\n{msg['content']}<|im_end|>")
        
        # 시스템 프롬프트 추가
        system_prompt = "<|im_start|>system\nYou are a helpful AI assistant. Please provide accurate and helpful responses.<|im_end|>"
        
        return system_prompt + "".join(formatted_messages) + "<|im_start|>assistant\n"
    
    async def generate_stream(
        self, 
        user_message: str, 
        conversation_id: str,
        max_length: Optional[int] = None,
        temperature: Optional[float] = None,
        top_p: Optional[float] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """스트리밍 방식으로 응답을 생성합니다."""
        
        if not self.is_initialized:
            yield {
                "type": "error",
                "content": "Qwen model is not initialized"
            }
            return
        
        try:
            # 파라미터 설정
            max_length = max_length or settings.QWEN_MAX_LENGTH
            temperature = temperature or settings.QWEN_TEMPERATURE
            top_p = top_p or settings.QWEN_TOP_P
            
            # 대화 포맷팅
            formatted_input = self._format_conversation(conversation_id, user_message)
            
            # 토큰화
            inputs = self.tokenizer(
                formatted_input,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=max_length
            ).to(self.device)
            
            qwen_logger.info(f"Generating response for conversation {conversation_id}")
            
            # 스트리밍 생성
            generated_text = ""
            with torch.no_grad():
                for outputs in self.model.generate(
                    **inputs,
                    max_new_tokens=max_length,
                    temperature=temperature,
                    top_p=top_p,
                    repetition_penalty=settings.QWEN_REPETITION_PENALTY,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id,
                    streamer=None,
                    return_dict_in_generate=True,
                    output_scores=False
                ):
                    # 새로 생성된 토큰 디코딩
                    new_tokens = outputs.sequences[0][inputs.input_ids.shape[1]:]
                    new_text = self.tokenizer.decode(new_tokens, skip_special_tokens=True)
                    
                    if new_text:
                        generated_text += new_text
                        yield {
                            "type": "chunk",
                            "content": new_text,
                            "conversation_id": conversation_id
                        }
                        
                        # 비동기 처리
                        await asyncio.sleep(0.01)
            
            # 완료 신호
            yield {
                "type": "complete",
                "content": generated_text,
                "conversation_id": conversation_id
            }
            
            # 대화 히스토리에 응답 추가
            self.conversation_history[conversation_id].append({
                "role": "assistant",
                "content": generated_text
            })
            
            qwen_logger.info(f"Response generated successfully for conversation {conversation_id}")
            
        except Exception as e:
            qwen_logger.error(f"Error generating response: {e}")
            yield {
                "type": "error",
                "content": f"Error generating response: {str(e)}"
            }
    
    async def generate_simple(self, prompt: str) -> str:
        """간단한 응답을 생성합니다."""
        try:
            if not self.is_initialized:
                return "Qwen model is not initialized"
            
            inputs = self.tokenizer(
                prompt,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=settings.QWEN_MAX_LENGTH
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=settings.QWEN_MAX_LENGTH,
                    temperature=settings.QWEN_TEMPERATURE,
                    top_p=settings.QWEN_TOP_P,
                    repetition_penalty=settings.QWEN_REPETITION_PENALTY,
                    do_sample=True,
                    pad_token_id=self.tokenizer.eos_token_id
                )
            
            response = self.tokenizer.decode(
                outputs[0][inputs.input_ids.shape[1]:],
                skip_special_tokens=True
            )
            
            return response
            
        except Exception as e:
            qwen_logger.error(f"Error in simple generation: {e}")
            return f"Error: {str(e)}"
    
    def clear_conversation(self, conversation_id: str):
        """특정 대화 히스토리를 삭제합니다."""
        if conversation_id in self.conversation_history:
            del self.conversation_history[conversation_id]
            qwen_logger.info(f"Cleared conversation history for {conversation_id}")
    
    def get_conversation_history(self, conversation_id: str) -> List[Dict[str, str]]:
        """대화 히스토리를 반환합니다."""
        return self.conversation_history.get(conversation_id, [])
    
    def get_model_info(self) -> Dict[str, Any]:
        """모델 정보를 반환합니다."""
        return {
            "model_name": settings.QWEN_MODEL_NAME,
            "device": self.device,
            "is_initialized": self.is_initialized,
            "max_length": settings.QWEN_MAX_LENGTH,
            "temperature": settings.QWEN_TEMPERATURE,
            "top_p": settings.QWEN_TOP_P,
            "repetition_penalty": settings.QWEN_REPETITION_PENALTY,
            "conversation_count": len(self.conversation_history)
        }

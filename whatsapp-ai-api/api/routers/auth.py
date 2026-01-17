"""
Authentication router
"""
from fastapi import APIRouter, HTTPException, Depends, status
from models import SessionLocal, Usuario
from api.schemas.auth import UserCreate, UserLogin, Token, UserResponse, PasswordChange
from auth import (
    get_password_hash, 
    verify_password, 
    create_access_token,
    get_current_user,
    get_current_admin_user
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate):
    """Register new user (first user becomes admin)"""
    db = SessionLocal()
    try:
        # Check if user exists
        existing_user = db.query(Usuario).filter(
            (Usuario.email == user_data.email) | (Usuario.username == user_data.username)
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email or username already registered"
            )
        
        # Check if this is the first user (becomes admin)
        user_count = db.query(Usuario).count()
        is_first_user = user_count == 0
        
        # Create user
        hashed_password = get_password_hash(user_data.password)
        new_user = Usuario(
            email=user_data.email,
            username=user_data.username,
            hashed_password=hashed_password,
            is_admin=is_first_user
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return new_user.to_dict()
    finally:
        db.close()


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """Login and get access token"""
    db = SessionLocal()
    try:
        user = db.query(Usuario).filter(Usuario.username == credentials.username).first()
        
        if not user or not verify_password(credentials.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )
        
        access_token = create_access_token(data={"sub": str(user.id)})
        
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }
    finally:
        db.close()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Usuario = Depends(get_current_user)):
    """Get current user info"""
    return current_user.to_dict()


@router.post("/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: Usuario = Depends(get_current_user)
):
    """Change user password"""
    db = SessionLocal()
    try:
        user = db.query(Usuario).filter(Usuario.id == current_user.id).first()
        
        if not verify_password(password_data.current_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect"
            )
        
        user.hashed_password = get_password_hash(password_data.new_password)
        db.commit()
        
        return {"status": "ok", "message": "Password changed successfully"}
    finally:
        db.close()


@router.get("/users", response_model=list[UserResponse])
async def list_users(current_user: Usuario = Depends(get_current_admin_user)):
    """List all users (admin only)"""
    db = SessionLocal()
    try:
        users = db.query(Usuario).all()
        return [u.to_dict() for u in users]
    finally:
        db.close()


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: Usuario = Depends(get_current_admin_user)
):
    """Delete user (admin only)"""
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    db = SessionLocal()
    try:
        user = db.query(Usuario).filter(Usuario.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        db.delete(user)
        db.commit()
        return {"status": "ok", "message": "User deleted"}
    finally:
        db.close()

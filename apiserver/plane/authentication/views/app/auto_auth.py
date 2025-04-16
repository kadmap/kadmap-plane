# Python imports
from urllib.parse import urlencode, urljoin

# Django imports
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

# Module imports
from plane.authentication.provider.credentials.email import EmailProvider
from plane.authentication.utils.login import user_login
from plane.license.models import Instance
from plane.authentication.utils.host import base_host
from plane.db.models import User
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)


class AutoAuthEndpoint(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Check instance configuration
        instance = Instance.objects.first()
        if instance is None or not instance.is_setup_done:
            return Response(
                {
                    "error": "INSTANCE_NOT_CONFIGURED",
                    "message": "Instance not configured. Please contact your administrator."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        email = request.data.get("email", False)
        password = request.data.get("password", False)
        first_name = request.data.get("first_name", "")
        last_name = request.data.get("last_name", "")

        # Return error if email or password is not present
        if not email or not password:
            return Response(
                {
                    "error": "REQUIRED_EMAIL_PASSWORD_SIGN_UP",
                    "message": "Email and password are required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate email
        email = email.strip().lower()
        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {
                    "error": "INVALID_EMAIL_SIGN_UP",
                    "message": "Please provide a valid email address."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user exists
        existing_user = User.objects.filter(email=email).first()

        try:
            if existing_user and existing_user.check_password(password):
                # User exists and password is correct
                user = existing_user
                # Login the user
                user_login(request=request, user=user, is_app=True)
                return Response(
                    {
                        "exists": True,
                        "authenticated": True,
                        "user": {
                            "email": user.email,
                            "first_name": user.first_name,
                            "last_name": user.last_name
                        }
                    },
                    status=status.HTTP_200_OK
                )
            else:
                # Create new user (either user doesn't exist or password is incorrect)
                try:
                    # If user exists with incorrect password, still proceed to create a user
                    create_user = True
                    
                    # Only check if we need to create a user if one exists
                    if existing_user:
                        # User exists but password is incorrect
                        # We'll proceed to create a user, but log this for debugging
                        print(f"User {email} exists but password is incorrect, creating new user anyway")
                    
                    if create_user:
                        provider = EmailProvider(
                            request=request,
                            key=email,
                            code=password,
                            is_signup=True,
                        )
                        user = provider.authenticate()
                        # Update user details
                        if first_name:
                            user.first_name = first_name
                        if last_name:
                            user.last_name = last_name
                        user.save()

                        # Login the user
                        user_login(request=request, user=user, is_app=True)
                        
                        # Return success response
                        return Response(
                            {
                                "created": True,
                                "authenticated": True,
                                "user": {
                                    "email": user.email,
                                    "first_name": user.first_name,
                                    "last_name": user.last_name
                                }
                            },
                            status=status.HTTP_201_CREATED
                        )
                except AuthenticationException as e:
                    return Response(
                        {
                            "error": e.error_code,
                            "message": e.error_message,
                            "created": False
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

        except AuthenticationException as e:
            return Response(
                {
                    "error": e.error_code,
                    "message": e.error_message,
                    "authenticated": False
                },
                status=status.HTTP_400_BAD_REQUEST
            ) 
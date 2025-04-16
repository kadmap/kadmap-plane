# Python imports
import os

# Django imports
from django.core.validators import validate_email
from django.core.exceptions import ValidationError

# Third party imports
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

## Module imports
from plane.db.models import User
from plane.license.models import Instance
from plane.authentication.adapter.error import (
    AuthenticationException,
    AUTHENTICATION_ERROR_CODES,
)
from plane.authentication.rate_limit import AuthenticationThrottle
from plane.license.utils.instance_value import get_configuration_value


class EmailCheckEndpoint(APIView):
    permission_classes = [AllowAny]

    throttle_classes = [AuthenticationThrottle]

    def post(self, request):
        # Check instance configuration
        instance = Instance.objects.first()
        if instance is None or not instance.is_setup_done:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INSTANCE_NOT_CONFIGURED"],
                error_message="INSTANCE_NOT_CONFIGURED",
            )
            return Response(exc.get_error_dict(), status=status.HTTP_400_BAD_REQUEST)

        (EMAIL_HOST, ENABLE_MAGIC_LINK_LOGIN) = get_configuration_value(
            [
                {"key": "EMAIL_HOST", "default": os.environ.get("EMAIL_HOST", "")},
                {
                    "key": "ENABLE_MAGIC_LINK_LOGIN",
                    "default": os.environ.get("ENABLE_MAGIC_LINK_LOGIN", "1"),
                },
            ]
        )

        smtp_configured = bool(EMAIL_HOST)
        is_magic_login_enabled = ENABLE_MAGIC_LINK_LOGIN == "1"

        email = request.data.get("email", False)

        # Return error if email is not present
        if not email:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["EMAIL_REQUIRED"],
                error_message="EMAIL_REQUIRED",
            )
            return Response(exc.get_error_dict(), status=status.HTTP_400_BAD_REQUEST)

        # Lower the email
        email = str(email).lower().strip()

        # Validate email
        try:
            validate_email(email)
        except ValidationError:
            exc = AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["INVALID_EMAIL"],
                error_message="INVALID_EMAIL",
            )
            return Response(exc.get_error_dict(), status=status.HTTP_400_BAD_REQUEST)
        # Check if a user already exists with the given email
        existing_user = User.objects.filter(email=email).first()

        # If existing user
        if existing_user:
            # Return response
            return Response(
                {
                    "existing": True,
                    "status": (
                        "MAGIC_CODE"
                        if existing_user.is_password_autoset
                        and smtp_configured
                        and is_magic_login_enabled
                        else "CREDENTIAL"
                    ),
                },
                status=status.HTTP_200_OK,
            )
        # Else return response
        return Response(
            {
                "existing": False,
                "status": (
                    "MAGIC_CODE"
                    if smtp_configured and is_magic_login_enabled
                    else "CREDENTIAL"
                ),
            },
            status=status.HTTP_200_OK,
        )


class UserAuthCheckEndpoint(APIView):
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

        email = request.data.get("email")
        password = request.data.get("password")

        # Return error if email or password is not present
        if not email or not password:
            return Response(
                {
                    "error": "REQUIRED_EMAIL_PASSWORD_SIGN_IN",
                    "message": "Email and password are required."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Lower the email
        email = str(email).lower().strip()

        # Validate email
        try:
            validate_email(email)
        except ValidationError:
            return Response(
                {
                    "error": "INVALID_EMAIL_SIGN_IN",
                    "message": "Please provide a valid email address."
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user exists
        user = User.objects.filter(email=email).first()
        if not user:
            return Response(
                {
                    "error": "USER_DOES_NOT_EXIST",
                    "message": "User does not exist.",
                    "exists": False
                },
                status=status.HTTP_200_OK
            )

        # Check password
        if not user.check_password(password):
            return Response(
                {
                    "error": "AUTHENTICATION_FAILED_SIGN_IN",
                    "message": "Invalid password.",
                    "exists": True
                },
                status=status.HTTP_200_OK
            )

        # If we get here, the user exists and the password is correct
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

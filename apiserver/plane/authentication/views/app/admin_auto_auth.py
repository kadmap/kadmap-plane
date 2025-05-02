# Python imports
from urllib.parse import urlencode, urljoin

# Django imports
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import HttpResponseRedirect
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework import status
from rest_framework.response import Response
from django.db import transaction

# Module imports
from plane.authentication.utils.login import user_login
from plane.license.models import Instance, InstanceAdmin
from plane.authentication.utils.host import base_host
from plane.db.models import User, Profile
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from django.contrib.auth.hashers import make_password
import uuid
from django.utils import timezone
from zxcvbn import zxcvbn


class AdminAutoAuthEndpoint(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Get the required fields for instance creation
        email = request.data.get("email", False)
        password = request.data.get("password", False)
        first_name = request.data.get("first_name", "")
        last_name = request.data.get("last_name", "")
        company_name = request.data.get("company_name", "")
        is_telemetry_enabled = request.data.get("is_telemetry_enabled", True)

        # Check instance first
        instance = Instance.objects.first()
        if instance is None:
            # Create a new instance if none exists
            instance = Instance.objects.create(
                instance_name=company_name,
                is_setup_done=False,
                is_telemetry_enabled=is_telemetry_enabled
            )

        # Check if admin exists and try to authenticate
        if InstanceAdmin.objects.first():
            # Validate required fields
            if not email or not password:
                return Response(
                    {
                        "error": AUTHENTICATION_ERROR_CODES["REQUIRED_ADMIN_EMAIL_PASSWORD"],
                        "message": "REQUIRED_ADMIN_EMAIL_PASSWORD",
                        "payload": {"email": email},
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
                        "error": AUTHENTICATION_ERROR_CODES["INVALID_ADMIN_EMAIL"],
                        "message": "INVALID_ADMIN_EMAIL",
                        "payload": {"email": email},
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Fetch and validate user
            user = User.objects.filter(email=email).first()
            if not user or not user.is_active or not user.check_password(password):
                return Response(
                    {
                        "error": AUTHENTICATION_ERROR_CODES["ADMIN_AUTHENTICATION_FAILED"],
                        "message": "ADMIN_AUTHENTICATION_FAILED",
                        "payload": {"email": email},
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if user is an instance admin
            if not InstanceAdmin.objects.filter(instance=instance, user=user).exists():
                return Response(
                    {
                        "error": AUTHENTICATION_ERROR_CODES["ADMIN_AUTHENTICATION_FAILED"],
                        "message": "ADMIN_AUTHENTICATION_FAILED",
                        "payload": {"email": email},
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Update user's last active and login information
            user.is_active = True
            user.last_active = timezone.now()
            user.last_login_time = timezone.now()
            user.last_login_ip = request.META.get("REMOTE_ADDR")
            user.last_login_uagent = request.META.get("HTTP_USER_AGENT")
            user.token_updated_at = timezone.now()
            user.save()

            # Login the user
            user_login(request=request, user=user, is_admin=True)

            # # Return success response with admin's general page URL
            # url = urljoin(base_host(request=request, is_admin=True), "general")
            # return Response(
            #     {
            #         "success": True,
            #         "message": "Admin authenticated successfully",
            #         "redirect_url": url,
            #         "user": {
            #             "email": user.email,
            #             "first_name": user.first_name,
            #             "last_name": user.last_name,
            #         }
            #     },
            #     status=status.HTTP_200_OK
            # )

        # Create new admin user
        if not email or not password or not first_name:
            return Response(
                {
                    "error": AUTHENTICATION_ERROR_CODES["REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME"],
                    "message": "REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME",
                    "payload": {
                        "email": email,
                        "first_name": first_name,
                        "last_name": last_name,
                        "company_name": company_name,
                        "is_telemetry_enabled": is_telemetry_enabled,
                    },
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
                    "error": AUTHENTICATION_ERROR_CODES["INVALID_ADMIN_EMAIL"],
                    "message": "INVALID_ADMIN_EMAIL",
                    "payload": {
                        "email": email,
                        "first_name": first_name,
                        "last_name": last_name,
                        "company_name": company_name,
                        "is_telemetry_enabled": is_telemetry_enabled,
                    },
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check password strength
        results = zxcvbn(password)
        if results["score"] < 3:
            return Response(
                {
                    "error": AUTHENTICATION_ERROR_CODES["INVALID_ADMIN_PASSWORD"],
                    "message": "INVALID_ADMIN_PASSWORD",
                    "payload": {
                        "email": email,
                        "first_name": first_name,
                        "last_name": last_name,
                        "company_name": company_name,
                        "is_telemetry_enabled": is_telemetry_enabled,
                    },
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the admin user and update instance in a transaction
        with transaction.atomic():
            # If user does not exist, create the admin user
            if not User.objects.filter(email=email).exists():
                # Create the admin user
                user = User.objects.create(
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    username=uuid.uuid4().hex,
                    password=make_password(password),
                    is_password_autoset=False,
                )
                # Create the profile
                _ = Profile.objects.create(user=user, company_name=company_name)
            else:
                user = User.objects.get(email=email)

            # Update user's last active and login information
            user.is_active = True
            user.last_active = timezone.now()
            user.last_login_time = timezone.now()
            user.last_login_ip = request.META.get("REMOTE_ADDR")
            user.last_login_uagent = request.META.get("HTTP_USER_AGENT")
            user.token_updated_at = timezone.now()
            user.save()

            # If user is not an instance admin, register the user as an instance admin  
            if not InstanceAdmin.objects.filter(user=user, instance=instance).exists():
                _ = InstanceAdmin.objects.create(user=user, instance=instance)

            # Update instance details
            instance.is_setup_done = True
            instance.instance_name = company_name
            instance.is_telemetry_enabled = is_telemetry_enabled
            instance.updated_at = timezone.now()
            instance.save()

            # Verify instance update
            instance.refresh_from_db()
            if not instance.is_setup_done:
                raise Exception("Instance setup flag not updated properly")

        # Login the user after the transaction is complete
        user_login(request=request, user=user, is_admin=True)

        # Redirect to general page
        url = urljoin(base_host(request=request, is_admin=True), "general")
        return HttpResponseRedirect(url) 
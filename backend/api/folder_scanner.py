"""
Folder Scanner Utility for Time Scheduler

Provides local filesystem scanning functionality to replace Google Drive integration.
Scans local folders for images and validates access permissions.
"""

import os
from pathlib import Path
from typing import List
from PIL import Image
from django.conf import settings


class InvalidFolderPathError(Exception):
    """Raised when folder path is invalid or does not exist."""
    pass


class FolderAccessDeniedError(Exception):
    """Raised when folder is not accessible due to permission issues."""
    pass


class NoImagesFoundError(Exception):
    """Raised when no valid images are found in the folder."""
    pass


class FolderScanner:
    """
    Utility class for scanning local folders for images.

    Features:
    - Validates folder paths (exists, readable, accessible)
    - Recursively scans for images (configurable)
    - Filters by allowed extensions
    - Validates image files (size, format)
    """

    def __init__(self, logger=None):
        """
        Initialize FolderScanner.

        Args:
            logger: Optional logger instance for logging
        """
        self.logger = logger
        self.max_size_bytes = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
        self.recursive = settings.RECURSIVE_FOLDER_SCAN
        self.allowed_extensions = [ext.lower() for ext in settings.ALLOWED_IMAGE_EXTENSIONS]

    def log_info(self, message):
        """Log info message if logger is available."""
        if self.logger:
            self.logger.info(message)

    def log_warning(self, message):
        """Log warning message if logger is available."""
        if self.logger:
            self.logger.warning(message)

    def log_error(self, message):
        """Log error message if logger is available."""
        if self.logger:
            self.logger.error(message)

    def validate_folder(self, folder_path: str) -> bool:
        """
        Validate that folder path exists, is a directory, and is readable.

        Args:
            folder_path: Path to folder to validate

        Returns:
            True if valid

        Raises:
            InvalidFolderPathError: If path does not exist or is not a directory
            FolderAccessDeniedError: If path is not readable
        """
        path = Path(folder_path)

        # Check if path exists
        if not path.exists():
            error_msg = f"Folder path does not exist: {folder_path}"
            self.log_error(error_msg)
            raise InvalidFolderPathError(error_msg)

        # Check if path is a directory
        if not path.is_dir():
            error_msg = f"Path is not a directory: {folder_path}"
            self.log_error(error_msg)
            raise InvalidFolderPathError(error_msg)

        # Check read permissions
        if not os.access(path, os.R_OK):
            error_msg = f"Folder is not readable (permission denied): {folder_path}"
            self.log_error(error_msg)
            raise FolderAccessDeniedError(error_msg)

        self.log_info(f"Folder validation successful: {folder_path}")
        return True

    def list_images(self, folder_path: str, recursive: bool = None) -> List[str]:
        """
        Scan folder for image files.

        Args:
            folder_path: Path to folder to scan
            recursive: Whether to scan subdirectories (default: from settings)

        Returns:
            List of absolute file paths to images

        Raises:
            InvalidFolderPathError: If folder is invalid
            FolderAccessDeniedError: If folder is not accessible
            NoImagesFoundError: If no images found in folder
        """
        # Validate folder first
        self.validate_folder(folder_path)

        # Use settings default if not specified
        if recursive is None:
            recursive = self.recursive

        folder = Path(folder_path)
        images = []

        self.log_info(f"Scanning folder: {folder_path} (recursive={recursive})")

        try:
            if recursive:
                # Scan all subdirectories
                for ext in self.allowed_extensions:
                    # Use rglob for recursive search
                    found = list(folder.rglob(f'*{ext}'))
                    images.extend(found)
                    # Also check uppercase extensions
                    found_upper = list(folder.rglob(f'*{ext.upper()}'))
                    images.extend(found_upper)
            else:
                # Scan only root folder
                for ext in self.allowed_extensions:
                    # Use glob for non-recursive search
                    found = list(folder.glob(f'*{ext}'))
                    images.extend(found)
                    # Also check uppercase extensions
                    found_upper = list(folder.glob(f'*{ext.upper()}'))
                    images.extend(found_upper)
        except PermissionError as e:
            error_msg = f"Permission denied while scanning folder: {e}"
            self.log_error(error_msg)
            raise FolderAccessDeniedError(error_msg)

        # Convert to absolute paths and remove duplicates
        image_paths = list(set([str(img.absolute()) for img in images]))

        if not image_paths:
            error_msg = f"No images found in folder: {folder_path}"
            self.log_warning(error_msg)
            raise NoImagesFoundError(error_msg)

        self.log_info(f"Found {len(image_paths)} images in folder")
        return sorted(image_paths)  # Sort for consistent ordering

    def get_image_count(self, folder_path: str, recursive: bool = None) -> int:
        """
        Get count of images in folder without listing all paths.

        Args:
            folder_path: Path to folder to scan
            recursive: Whether to scan subdirectories (default: from settings)

        Returns:
            Number of images found
        """
        try:
            images = self.list_images(folder_path, recursive)
            return len(images)
        except NoImagesFoundError:
            return 0

    def validate_image_file(self, file_path: str) -> bool:
        """
        Validate that a file is a valid image.

        Checks:
        - File exists and is readable
        - File size is within limits
        - File can be opened as image (valid format)

        Args:
            file_path: Path to image file

        Returns:
            True if valid, False otherwise
        """
        path = Path(file_path)

        # Check if file exists
        if not path.exists() or not path.is_file():
            self.log_warning(f"File does not exist: {file_path}")
            return False

        # Check file size
        try:
            file_size = path.stat().st_size
            if file_size > self.max_size_bytes:
                size_mb = file_size / (1024 * 1024)
                self.log_warning(
                    f"File exceeds size limit ({size_mb:.2f}MB > {settings.MAX_IMAGE_SIZE_MB}MB): {file_path}"
                )
                return False
        except OSError as e:
            self.log_warning(f"Cannot get file size: {file_path} - {e}")
            return False

        # Check if file can be opened as image
        try:
            with Image.open(file_path) as img:
                img.verify()  # Verify it's a valid image
            return True
        except Exception as e:
            self.log_warning(f"Invalid image file: {file_path} - {e}")
            return False

    def get_valid_images(self, folder_path: str, recursive: bool = None) -> List[str]:
        """
        Get list of valid images from folder (with validation).

        This method is slower than list_images() because it validates each file,
        but ensures all returned files are valid images.

        Args:
            folder_path: Path to folder to scan
            recursive: Whether to scan subdirectories (default: from settings)

        Returns:
            List of absolute file paths to valid images
        """
        all_images = self.list_images(folder_path, recursive)
        valid_images = []

        self.log_info(f"Validating {len(all_images)} images...")

        for image_path in all_images:
            if self.validate_image_file(image_path):
                valid_images.append(image_path)

        self.log_info(f"Found {len(valid_images)} valid images (out of {len(all_images)})")

        if not valid_images:
            raise NoImagesFoundError(f"No valid images found in folder: {folder_path}")

        return valid_images

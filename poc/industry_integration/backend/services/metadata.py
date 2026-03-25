import os
import json
import datetime
import datetime

class MetadataExtractor:
    """
    A class to extract and save metadata from a file.
    """

    def __init__(self, file_path):
        """
        Initialize the MetadataExtractor with a file path.

        Args:
            file_path (str): Path to the file.
        """
        self.file_path = file_path
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"File not found: {self.file_path}")

    def extract_metadata(self):
        """
        Extract metadata from the specified file or multiple files.
        This method retrieves various metadata attributes of the file(s), including
        their name, size, extension, absolute path, and creation time.

        Returns:
            list: A list of dictionaries containing metadata information for each file.
                  Each dictionary contains:
                  - file_name (str): The base name of the file.
                  - file_size (int): The size of the file in bytes.
                  - file_extension (str): The file extension (e.g., '.txt').
                  - absolute_path (str): The absolute path to the file.
                  - created_time (str): The creation time of the file in the format 'YYYY-MM-DD HH:MM:SS'.
                  - created_time (float): The creation time of the file as a timestamp.
        """
        if isinstance(self.file_path, str):
            file_paths = [self.file_path]
        elif isinstance(self.file_path, list):
            file_paths = self.file_path
        else:
            raise ValueError("file_path must be a string or a list of strings")

        metadata_list = []
        for path in file_paths:
            if not os.path.exists(path):
                raise FileNotFoundError(f"File not found: {path}")
            metadata = {
                "file_name": os.path.basename(path),
                "file_size": os.path.getsize(path),
                "file_extension": os.path.splitext(path)[1],
                "absolute_path": os.path.abspath(path),
                "created_time": datetime.datetime.fromtimestamp(os.path.getctime(path)).strftime('%Y-%m-%d %H:%M:%S'),
                "created_timestamp": os.path.getctime(path),
            }
            metadata_list.append(metadata)

        return metadata_list

    def save_metadata_to_json(self, output_path):
        """
        Save metadata to a JSON file.

        Args:
            output_path (str): Path to save the JSON file.
        """
        metadata = self.extract_metadata()
        with open(output_path, 'w') as json_file:
            json.dump(metadata, json_file, indent=4)



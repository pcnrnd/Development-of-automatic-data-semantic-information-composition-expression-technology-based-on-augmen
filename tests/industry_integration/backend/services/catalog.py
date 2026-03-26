import datetime

class DatasetCatalog:
    def __init__(self):
        self.datasets = {}

    def add_dataset(self, name, description, data_format, created_at=None):
        if created_at is None:
            created_at = datetime.datetime.now()
        self.datasets[name] = {
            'name': name,
            'description': description,
            'data_format': data_format,
            'created_at': created_at,
        }

    def get_dataset(self, name):
        return self.datasets.get(name, "Dataset not found")

    def list_datasets(self):
        return [dataset['name'] for dataset in self.datasets.values()]
    
    def remove_dataset(self, name):
        if name in self.datasets:
            del self.datasets[name]
        else:
            print(f"Dataset '{name}' not found.")
    
    def update_dataset(self, name, description=None, data_format=None):
        if name in self.datasets:
            if description:
                self.datasets[name]['description'] = description
            if data_format:
                self.datasets[name]['data_format'] = data_format
        else:
            print(f"Dataset '{name}' not found.")

from pony.orm import *
from decouple import config

db = Database()

# Binding, establecer la conexión con la base de datos.
db.bind(provider=config("DB_PROVIDER"), user=config("DB_USER"), password=config("DB_PASS"),
        host=config("DB_HOST"), database=config("DB_NAME"))
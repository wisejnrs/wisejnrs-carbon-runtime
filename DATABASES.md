# Database Features in Carbon

Carbon images include comprehensive database support with vector search and geospatial capabilities.

---

## 📦 Included Databases

All databases are **OFF by default** to save resources. Enable only what you need!

### 1. PostgreSQL 14
**Traditional relational database with powerful extensions**

**Enable:**
```bash
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh
```

**Connection:**
```
Host: localhost
Port: 5432
User: postgres or carbon
Password: Carbon123# (or your POSTGRES_PASSWORD)
Database: carbon
```

**Installed Extensions:**
- ✅ **pgvector v0.5.0** - Vector similarity search for AI/ML
- ✅ **PostGIS 3.x** - Geographic/spatial data support
- ✅ **postgres_fdw** - Foreign data wrappers
- ✅ **pg_stat_statements** - Query performance tracking
- ✅ **uuid-ossp** - UUID generation

**Example:**
```sql
-- Enable pgvector
CREATE EXTENSION vector;

-- Create table with vector column
CREATE TABLE items (
  id serial PRIMARY KEY,
  embedding vector(1536)
);

-- Vector similarity search
SELECT * FROM items
ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector
LIMIT 10;

-- Enable PostGIS
CREATE EXTENSION postgis;

-- Store geographic data
CREATE TABLE locations (
  id serial PRIMARY KEY,
  name text,
  geom geometry(Point, 4326)
);

-- Spatial query
SELECT name FROM locations
WHERE ST_DWithin(geom, ST_MakePoint(-73.935242, 40.730610), 1000);
```

### 2. MongoDB 7.0
**Document database for flexible schemas**

**Enable:**
```bash
ENABLE_MONGODB=true ./start-carbon-configurable.sh
```

**Connection:**
```
Host: localhost
Port: 27017
User: carbon
Password: Carbon123# (or your MONGODB_PASSWORD)
Database: carbon
```

**Example:**
```javascript
// Connect with mongosh
mongosh "mongodb://carbon:Carbon123#@localhost:27017/carbon"

// Insert documents
db.users.insertOne({
  name: "John Doe",
  email: "john@example.com",
  tags: ["developer", "python"]
})

// Query
db.users.find({ tags: "python" })
```

### 3. Redis 7.x
**In-memory data store for caching and real-time**

**Enable:**
```bash
ENABLE_REDIS=true ./start-carbon-configurable.sh
```

**Connection:**
```
Host: localhost
Port: 6379
Password: None (localhost only)
```

**Example:**
```bash
# Connect with redis-cli
redis-cli

# Set/get values
SET mykey "Hello"
GET mykey

# Lists
LPUSH mylist "item1"
LPUSH mylist "item2"
LRANGE mylist 0 -1

# Pub/sub
SUBSCRIBE mychannel
PUBLISH mychannel "message"
```

### 4. Mosquitto MQTT
**Lightweight message broker for IoT**

**Enable:**
```bash
ENABLE_MOSQUITTO=true ./start-carbon-configurable.sh
```

**Connection:**
```
Host: localhost
Port: 8883
```

**Example:**
```bash
# Subscribe to topic
mosquitto_sub -t test/topic

# Publish message
mosquitto_pub -t test/topic -m "Hello MQTT"
```

### 5. Qdrant Vector Database ✨ NEW
**High-performance vector similarity search for AI/ML**

**Enable:**
```bash
ENABLE_QDRANT=true ./start-carbon-configurable.sh
```

**Connection:**
```
HTTP API: http://localhost:6333
gRPC API: localhost:6334
Dashboard: http://localhost:6333/dashboard
```

**Features:**
- Vector similarity search (cosine, euclidean, dot product)
- Filtering and payloads
- Multi-tenant collections
- Real-time updates
- REST and gRPC APIs

**Example (Python):**
```python
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

# Connect
client = QdrantClient(host="localhost", port=6333)

# Create collection
client.create_collection(
    collection_name="my_collection",
    vectors_config=VectorParams(size=384, distance=Distance.COSINE)
)

# Insert vectors
client.upsert(
    collection_name="my_collection",
    points=[
        PointStruct(
            id=1,
            vector=[0.1, 0.2, 0.3, ...],  # 384 dimensions
            payload={"text": "Hello world"}
        )
    ]
)

# Search
results = client.search(
    collection_name="my_collection",
    query_vector=[0.1, 0.2, 0.3, ...],
    limit=10
)
```

**Example (curl):**
```bash
# Create collection
curl -X PUT http://localhost:6333/collections/test \
  -H 'Content-Type: application/json' \
  -d '{
    "vectors": {
      "size": 384,
      "distance": "Cosine"
    }
  }'

# Insert point
curl -X PUT http://localhost:6333/collections/test/points \
  -H 'Content-Type: application/json' \
  -d '{
    "points": [
      {
        "id": 1,
        "vector": [0.1, 0.2, ...],
        "payload": {"text": "example"}
      }
    ]
  }'

# Search
curl -X POST http://localhost:6333/collections/test/points/search \
  -H 'Content-Type: application/json' \
  -d '{
    "vector": [0.1, 0.2, ...],
    "limit": 10
  }'
```

---

## 🎯 Use Cases by Database

### PostgreSQL + pgvector
**Best for:**
- Semantic search in AI applications
- Document embeddings storage
- RAG (Retrieval Augmented Generation) systems
- Combining vector and relational data

**Example workflow:**
1. Generate embeddings with OpenAI/Ollama
2. Store in PostgreSQL with pgvector
3. Perform similarity searches
4. Join with traditional relational data

### PostgreSQL + PostGIS
**Best for:**
- Mapping applications
- Location-based services
- Geographic data analysis
- Spatial queries

**Example workflow:**
1. Store points, lines, polygons
2. Perform distance calculations
3. Find nearby locations
4. Analyze geographic patterns

### MongoDB
**Best for:**
- Flexible schemas
- Rapid prototyping
- Document storage
- JSON-heavy applications
- Horizontal scaling

### Redis
**Best for:**
- Caching API responses
- Session storage
- Real-time leaderboards
- Rate limiting
- Pub/sub messaging

### Mosquitto MQTT
**Best for:**
- IoT sensor data
- Real-time messaging
- Lightweight protocols
- Embedded devices

### Qdrant
**Best for:**
- High-performance vector search
- Large-scale embeddings (millions+)
- Neural search applications
- Recommendation engines
- Image/audio similarity

---

## 🔀 Combining Databases

### RAG System (PostgreSQL + Qdrant)
```python
# Store documents in PostgreSQL
# Store embeddings in Qdrant for fast search
# Combine for retrieval augmented generation

# In PostgreSQL: Store document metadata
INSERT INTO documents (id, title, content, created_at)
VALUES (1, 'My Document', 'Content...', NOW());

# In Qdrant: Store embeddings for semantic search
client.upsert(
    collection_name="documents",
    points=[PointStruct(
        id=1,
        vector=embedding,
        payload={"doc_id": 1}
    )]
)

# Search: Find similar in Qdrant, get full docs from PostgreSQL
results = client.search(collection_name="documents", query_vector=query_embedding)
doc_ids = [r.payload["doc_id"] for r in results]
# Then: SELECT * FROM documents WHERE id IN (...)
```

### Geospatial Analytics (PostgreSQL + PostGIS + Redis)
```python
# Store location data in PostGIS
# Cache frequent queries in Redis
# Real-time updates via Redis pub/sub
```

### IoT Platform (Mosquitto + MongoDB + Redis)
```python
# Receive sensor data via MQTT (Mosquitto)
# Store historical data in MongoDB
# Cache current values in Redis
```

---

## 📊 Database Comparison

| Database | Type | When to Use | Memory | Disk |
|----------|------|-------------|--------|------|
| PostgreSQL | Relational | Structured data, ACID, complex queries | ~200MB | Medium |
| PostgreSQL+pgvector | Relational+Vector | AI/ML with relational data | ~300MB | Medium |
| PostgreSQL+PostGIS | Relational+Spatial | Geographic/mapping apps | ~400MB | Medium |
| MongoDB | Document | Flexible schemas, JSON data | ~500MB | High |
| Redis | In-memory | Caching, sessions, real-time | ~50MB | Low |
| Mosquitto | Message Broker | IoT, lightweight messaging | ~10MB | Low |
| Qdrant | Vector | High-scale vector search | ~200MB+ | High |

---

## 🚀 Quick Start Examples

### Enable PostgreSQL with Vector Search
```bash
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh

# Test
docker exec carbon-base psql -U postgres -c "CREATE EXTENSION vector; SELECT extversion FROM pg_extension WHERE extname='vector';"
```

### Enable PostgreSQL with PostGIS
```bash
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh

# Test
docker exec carbon-base psql -U postgres -c "CREATE EXTENSION postgis; SELECT PostGIS_Version();"
```

### Enable All Databases
```bash
ENABLE_POSTGRESQL=true \
ENABLE_MONGODB=true \
ENABLE_REDIS=true \
ENABLE_QDRANT=true \
./start-carbon-configurable.sh
```

### Vector Search Stack (PostgreSQL + Qdrant)
```bash
ENABLE_POSTGRESQL=true \
ENABLE_QDRANT=true \
./start-carbon-configurable.sh --image compute

# Access:
# PostgreSQL: localhost:5432
# Qdrant HTTP: http://localhost:6333
# Qdrant Dashboard: http://localhost:6333/dashboard
```

---

## 🔧 Administration

### PostgreSQL

**Connect:**
```bash
docker exec -it carbon-base psql -U postgres
```

**Create database:**
```sql
CREATE DATABASE myapp;
CREATE USER myuser WITH PASSWORD 'mypass';
GRANT ALL PRIVILEGES ON DATABASE myapp TO myuser;
```

**Enable extensions:**
```sql
\c myapp
CREATE EXTENSION vector;      -- Vector similarity
CREATE EXTENSION postgis;     -- Geographic data
CREATE EXTENSION "uuid-ossp"; -- UUID generation
```

**Backup:**
```bash
docker exec carbon-base pg_dump -U postgres myapp > backup.sql
```

**Restore:**
```bash
cat backup.sql | docker exec -i carbon-base psql -U postgres myapp
```

### MongoDB

**Connect:**
```bash
docker exec -it carbon-base mongosh
```

**Create user:**
```javascript
use admin
db.createUser({
  user: "myuser",
  pwd: "mypass",
  roles: ["readWrite", "dbAdmin"]
})
```

**Backup:**
```bash
docker exec carbon-base mongodump --out=/data/mongodb-backup
```

### Redis

**Connect:**
```bash
docker exec -it carbon-base redis-cli
```

**Monitor:**
```bash
docker exec carbon-base redis-cli MONITOR
```

**Get info:**
```bash
docker exec carbon-base redis-cli INFO
```

### Qdrant

**Web Dashboard:**
```
http://localhost:6333/dashboard
```

**Health check:**
```bash
curl http://localhost:6333/health
```

**Collections:**
```bash
curl http://localhost:6333/collections
```

---

## 💾 Data Persistence

All databases store data in `/data` volume:

```
/data/
├── postgresql/       # PostgreSQL data
├── mongodb/          # MongoDB data
├── redis/            # Redis dumps
├── qdrant/           # Qdrant collections
└── mosquitto/        # MQTT persistence
```

**Mount from host:**
```bash
./start-carbon-configurable.sh --data-dir /mnt/storage/carbon-data
```

Your data persists between container restarts!

---

## 🐍 Python Clients

All images include Python clients for these databases:

```python
# PostgreSQL
import psycopg2
from pgvector.psycopg2 import register_vector
conn = psycopg2.connect("host=localhost dbname=carbon user=postgres password=Carbon123#")
register_vector(conn)

# MongoDB
from pymongo import MongoClient
client = MongoClient("mongodb://carbon:Carbon123#@localhost:27017/")

# Redis
import redis
r = redis.Redis(host='localhost', port=6379)

# Qdrant
from qdrant_client import QdrantClient
client = QdrantClient(host="localhost", port=6333)
```

---

## 🎯 Recommended Combinations

### AI/ML with Vector Search
```bash
ENABLE_POSTGRESQL=true \
ENABLE_QDRANT=true \
ENABLE_REDIS=true \
./start-carbon-configurable.sh --image compute
```

**Use:**
- PostgreSQL + pgvector: Structured data with embeddings
- Qdrant: High-performance vector search
- Redis: Caching embeddings and results

### Web Application
```bash
ENABLE_POSTGRESQL=true \
ENABLE_REDIS=true \
./start-carbon-configurable.sh
```

**Use:**
- PostgreSQL: Main database
- Redis: Session storage and caching

### IoT Platform
```bash
ENABLE_MONGODB=true \
ENABLE_REDIS=true \
ENABLE_MOSQUITTO=true \
./start-carbon-configurable.sh
```

**Use:**
- MQTT: Receive sensor data
- MongoDB: Store time-series data
- Redis: Real-time metrics

### GIS Application
```bash
ENABLE_POSTGRESQL=true \
ENABLE_REDIS=true \
./start-carbon-configurable.sh
```

**Use:**
- PostgreSQL + PostGIS: Geographic queries
- Redis: Cache map tiles and queries

---

## 📚 Extension Documentation

### pgvector
- **GitHub**: https://github.com/pgvector/pgvector
- **Use cases**: Semantic search, recommendations, RAG systems
- **Vector types**: Supports OpenAI, Cohere, Sentence Transformers
- **Distance metrics**: L2, inner product, cosine

### PostGIS
- **Website**: https://postgis.net/
- **Use cases**: Mapping, routing, spatial analysis
- **Data types**: Point, LineString, Polygon, MultiPoint, etc.
- **Functions**: Distance, intersection, buffer, centroid, etc.

### Qdrant
- **Website**: https://qdrant.tech/
- **Docs**: https://qdrant.tech/documentation/
- **Use cases**: Large-scale vector search, neural search
- **Features**: Filtering, payloads, collections, snapshots

---

## 🔍 Which Vector Database to Choose?

### PostgreSQL + pgvector
**Choose when:**
- Need to combine vectors with relational data
- Want ACID guarantees
- Have moderate scale (< 1M vectors)
- Need complex filters with JOINs

**Pros:**
- Single database for everything
- SQL familiarity
- Strong consistency

**Cons:**
- Slower than dedicated vector DBs at scale
- Limited to ~1-10M vectors efficiently

### Qdrant
**Choose when:**
- Need high-performance vector search
- Working with millions of vectors
- Want dedicated vector database
- Need advanced filtering

**Pros:**
- Very fast similarity search
- Scales to billions of vectors
- Built specifically for vectors
- Great filtering capabilities

**Cons:**
- Separate database to manage
- Not ACID for related data
- Requires learning new API

### Use Both!
**Best practice for AI/ML:**
- **Qdrant**: Fast vector similarity search
- **PostgreSQL**: Metadata, relationships, structured data
- **Redis**: Caching results

---

## 💡 Tips & Best Practices

### 1. Start Small, Scale Later
Begin with PostgreSQL + pgvector, move to Qdrant if you need better performance at scale.

### 2. Use Connection Pooling
```python
# PostgreSQL
from psycopg2 import pool
connection_pool = pool.SimpleConnectionPool(1, 20, dsn="...")

# MongoDB
client = MongoClient("...", maxPoolSize=50)
```

### 3. Index Your Data
```sql
-- PostgreSQL
CREATE INDEX ON items USING ivfflat (embedding vector_cosine_ops);

-- MongoDB
db.users.createIndex({ email: 1 })
```

### 4. Monitor Performance
```bash
# PostgreSQL
docker exec carbon-base psql -U postgres -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"

# Redis
docker exec carbon-base redis-cli INFO stats
```

### 5. Regular Backups
```bash
# Automated backup script
docker exec carbon-base pg_dump -U postgres carbon > backup-$(date +%Y%m%d).sql
docker exec carbon-base mongodump --out=/data/backup-$(date +%Y%m%d)
```

---

## 🚨 Troubleshooting

### PostgreSQL extension not found
```bash
# Check available extensions
docker exec carbon-base psql -U postgres -c "\dx"

# Manually create extension
docker exec carbon-base psql -U postgres -c "CREATE EXTENSION vector;"
docker exec carbon-base psql -U postgres -c "CREATE EXTENSION postgis;"
```

### Qdrant not starting
```bash
# Check logs
docker exec carbon-base tail -f /var/log/qdrant/out.log

# Check if enabled
docker exec carbon-base supervisorctl status qdrant

# Manually start
docker exec carbon-base supervisorctl start qdrant
```

### Connection refused
```bash
# Check service is enabled
docker exec carbon-base env | grep ENABLE_

# Check service is running
docker exec carbon-base supervisorctl status | grep postgres

# Check port mapping
docker port carbon-base
```

---

## 📖 Resources

- **PostgreSQL**: https://www.postgresql.org/docs/
- **pgvector**: https://github.com/pgvector/pgvector
- **PostGIS**: https://postgis.net/documentation/
- **MongoDB**: https://www.mongodb.com/docs/
- **Redis**: https://redis.io/documentation
- **Qdrant**: https://qdrant.tech/documentation/
- **Mosquitto**: https://mosquitto.org/documentation/

---

**Carbon gives you a complete database stack for any workflow!** 🗄️

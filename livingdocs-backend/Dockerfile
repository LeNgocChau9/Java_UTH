# Multi-stage Dockerfile tối ưu cho Spring Boot trên Render.com (512MB RAM)

# Stage 1: Build ứng dụng bằng Maven và OpenJDK 17
FROM maven:3.9.6-eclipse-temurin-17-alpine AS builder
WORKDIR /build

# Cache dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B || true

# Biên dịch mã nguồn và đóng gói JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Runtime Container siêu nhẹ với JRE 17 Alpine
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Tạo non-root user để tăng tính bảo mật
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Copy file jar từ Stage 1
COPY --from=builder /build/target/*.jar app.jar

# Cấu hình RAM: tối đa 384MB để hoạt động hoàn hảo trong gói 512MB RAM miễn phí của Render
ENV JAVA_OPTS="-Xmx384m -Xms128m -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError" \
    PORT=8080

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar --server.port=${PORT:-8080}"]

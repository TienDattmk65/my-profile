# Stage 1: Build source code bằng Node.js Alpine
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy toàn bộ mã nguồn
COPY . .

# Build production bundle
RUN npm run build

# Stage 2: Serve tĩnh bằng Nginx Alpine siêu nhẹ
FROM nginx:alpine

# Xóa trang mặc định của Nginx
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts từ Stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy cấu hình Nginx tối ưu
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

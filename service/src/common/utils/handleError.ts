import axios from 'axios';

export function handleError(error: any) {
  let message = '发生未知错误，请稍后再试';

  if (axios.isAxiosError(error) && error.response) {
    const status = error.response.status;
    const data = error.response.data as any;
    // 星尘文档：错误体常见字段 errorMessage / errorCode / success / httpStatusCode
    const serverMsg =
      data?.errorMessage || data?.message || data?.msg || data?.error || data?.reason;
    const code = data?.errorCode || data?.code;

    switch (status) {
      case 400:
        message = '发生错误：400 Bad Request - 请求因格式错误无法被服务器处理。';
        break;
      case 401:
        message = '发生错误：401 Unauthorized - 请求要求进行身份验证。';
        break;
      case 403:
        message = '发生错误：403 Forbidden - 服务器拒绝执行请求。';
        break;
      case 404:
        message = '发生错误：404 Not Found - 请求的资源无法在服务器上找到。';
        break;
      case 500:
        message = '发生错误：500 Internal Server Error - 服务器内部错误，无法完成请求。';
        break;
      case 502:
        message = '发生错误：502 Bad Gateway - 上游服务返回无效响应。';
        break;
      case 503:
        message = '发生错误：503 Service Unavailable - 服务暂不可用或维护中。';
        break;
      default:
        message = `发生错误：${status}`;
        break;
    }

    if (serverMsg) {
      message += ` 详细信息：${serverMsg}`;
    }
    if (code && String(code) !== String(status)) {
      message += ` (错误码：${code})`;
    }
  } else {
    // 处理非Axios错误
    message = error?.message || message;
  }

  // 返回处理后的错误信息
  return message;
}

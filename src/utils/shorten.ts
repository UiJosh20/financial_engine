// src/utils/shorten.ts

export async function shortenUrl(longUrl: string): Promise<string> {
  try {
    const apiUrl = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`;
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const shortUrl = await response.text();
    return shortUrl;
  } catch (error) {
    console.error('❌ Failed to shorten URL:', error);
    return longUrl; // Fallback to the original URL if the service fails
  }
}

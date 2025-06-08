const axios = require('axios');
const MockAdapter = require('axios-mock-adapter');

// Create a simple auth module for testing
const auth = {
  async login(email, password, baseURL = 'https://api.tellet.ai') {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const api = axios.create({ baseURL });
    
    try {
      const response = await api.post('/users/login', {
        email,
        password,
      });

      if (!response.data || !response.data.token) {
        throw new Error('Invalid response from login endpoint');
      }

      return response.data.token;
    } catch (error) {
      if (error.response) {
        const message = error.response.data?.message || 'Authentication failed';
        throw new Error(message);
      }
      throw error;
    }
  }
};

describe('Authentication', () => {
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
      const mockResponse = {
        token: mockToken,
        user: {
          id: testUtils.generateObjectId(),
          email: 'test@example.com',
        }
      };

      mock.onPost('/users/login').reply(200, mockResponse);

      const token = await auth.login('test@example.com', 'password123');
      
      expect(token).toBe(mockToken);
      expect(mock.history.post.length).toBe(1);
      expect(mock.history.post[0].data).toBe(JSON.stringify({
        email: 'test@example.com',
        password: 'password123'
      }));
    });

    it('should throw error when credentials are missing', async () => {
      await expect(auth.login('', 'password')).rejects.toThrow('Email and password are required');
      await expect(auth.login('email', '')).rejects.toThrow('Email and password are required');
      await expect(auth.login()).rejects.toThrow('Email and password are required');
    });

    it('should handle authentication failure', async () => {
      mock.onPost('/users/login').reply(401, {
        message: 'Invalid credentials'
      });

      await expect(auth.login('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });

    it('should handle network errors', async () => {
      mock.onPost('/users/login').networkError();

      await expect(auth.login('test@example.com', 'password123'))
        .rejects.toThrow('Network Error');
    });

    it('should handle server errors', async () => {
      mock.onPost('/users/login').reply(500, {
        message: 'Internal server error'
      });

      await expect(auth.login('test@example.com', 'password123'))
        .rejects.toThrow('Internal server error');
    });

    it('should handle invalid response format', async () => {
      mock.onPost('/users/login').reply(200, {
        // Missing token field
        user: { id: '123' }
      });

      await expect(auth.login('test@example.com', 'password123'))
        .rejects.toThrow('Invalid response from login endpoint');
    });

    it('should use custom API URL when provided', async () => {
      const customURL = 'https://api-staging.tellet.ai';
      mock.onPost(`${customURL}/users/login`).reply(200, {
        token: 'staging-token'
      });

      const token = await auth.login('test@example.com', 'password123', customURL);
      
      expect(token).toBe('staging-token');
    });
  });
});
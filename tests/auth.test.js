const request = require('supertest');
const express = require('express');
require('dotenv').config();

// Boot minimal app for tests
const app = require('../server');

describe('Auth flow', () => {
  it('register -> login -> refresh -> logout', async () => {
    const email = `user${Date.now()}@test.com`;
    const register = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test', email, password: 'Aa!23456' });
    expect(register.status).toBe(201);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Aa!23456' });
    expect(login.status).toBe(200);
    expect(login.body.accessToken).toBeTruthy();
    expect(login.body.refreshToken).toBeTruthy();

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.accessToken).toBeTruthy();

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: login.body.refreshToken });
    expect(logout.status).toBe(200);
  });
});


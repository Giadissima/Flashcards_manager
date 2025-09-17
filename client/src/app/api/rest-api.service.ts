import * as qs from 'qs';

import { EventEmitter, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';

import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

/**
 * Api is a generic REST API Service. Set your API url first.
 */
@Injectable({
  providedIn: 'root'
})
export class RestClientService {
  private url: string = '/api'; // ? /api è in realtà la base url che possiamo trovare nel file angular-proxy.conf.json nella root del progetto

  public offlineException: EventEmitter<HttpErrorResponse> = new EventEmitter();
  public serverErrorException: EventEmitter<HttpErrorResponse> = new EventEmitter();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) { }

  async get<T>(endpoint: string, params?: any, reqOpts?: any): Promise<T> {
  
    if (!reqOpts || reqOpts == null) {
      reqOpts = {
        headers: new HttpHeaders()
      };
    } 

    // ? con qs posso passare oggetti complessi nella query string
    const qsParams = qs.stringify(params);
    const url = this.url + endpoint + "?" + qsParams;

    return firstValueFrom(this.http.get(url, reqOpts)).catch(error => {
      console.error("[GET] error", error);
      if (error.status == 401) {
          this.router.navigate(['']);
      }
      else if (error.status == 0) {
        this.offlineException.emit(error);
      }
      else if (error.status >= 500) {
        this.serverErrorException.emit(error);
      }
      throw error;
    }) as unknown as Promise<T>;
  }

  async post(endpoint: string, body: any, httpParams?: HttpParams): Promise<any> {
    
    const reqOpts = {
      params: new HttpParams(),
      headers: new HttpHeaders()
    };

    reqOpts.params = httpParams || new HttpParams();

    return firstValueFrom(this.http.post(this.url + endpoint, body, reqOpts))
      .catch((error) => {
        console.log("[POST] error", error);
        if (error.status == 401 && ((error.error || {}).error || {}).code == 'INVALID_TOKEN') {
        } else if (error.status == 0) {
          this.offlineException.emit(error);
        } else if (error.status >= 500) {
          this.serverErrorException.emit(error);
        }
        throw error;
      });
  }

  async postToAnotherEndpoint(endpoint: string, body: any, httpParams?: HttpParams): Promise<any> {
    
    const reqOpts = {
      params: new HttpParams(),
      headers: new HttpHeaders()
    };

    reqOpts.params = httpParams || new HttpParams();

    return firstValueFrom(this.http.post(endpoint, body, reqOpts))
      .catch((error) => {
        console.log("[POST] error", error);
        if (error.status == 401 && ((error.error || {}).error || {}).code == 'INVALID_TOKEN') {
        } else if (error.status == 0) {
          this.offlineException.emit(error);
        } else if (error.status >= 500) {
          this.serverErrorException.emit(error);
        }
        throw error;
      });
  }

  async put(endpoint: string, body: any, httpParams?: HttpParams): Promise<any> {

    const reqOpts = {
      params: httpParams || new HttpParams(),
      headers: new HttpHeaders()
    };

    return firstValueFrom(this.http.put(this.url + endpoint, body, reqOpts))
      .catch((error) => {
        console.log("[PUT] error", error);
        if (error.status == 401 && ((error.error || {}).error || {}).code == 'INVALID_TOKEN') {
        } else if (error.status == 0) {
          this.offlineException.emit(error);
        } else if (error.status >= 500) {
          this.serverErrorException.emit(error);
        }
        throw error;
      });
  }

  async delete<T>(endpoint: string, params?: any, reqOpts?: any, locale?: string): Promise<T> {
    const loc = locale || "it";
    if (!reqOpts || reqOpts == null) {
      reqOpts = {
        params: new HttpParams(),
        headers: new HttpHeaders()
      };
    }

    // Support easy query params for GET requests
    reqOpts.params = new HttpParams();
    if (params) {
      for (let k in params) {
        if (params[k] != null) reqOpts.params = reqOpts.params.set(k, params[k]);
      }
    }

    return firstValueFrom(this.http.delete(this.url + endpoint, reqOpts)).catch(error => {
      console.error("[DELETE] error", error);
      if (error.status == 401 && ((error.error || {}).error || {}).code == 'INVALID_TOKEN') {
          this.router.navigate(['/auth/logout']);
      }
      else if (error.status == 0) {
        this.offlineException.emit(error);
      }
      else if (error.status >= 500) {
        this.serverErrorException.emit(error);
      }
      throw error;
    }) as unknown as Promise<T>;
  }

}


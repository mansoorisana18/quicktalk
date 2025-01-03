package com.quicktalk.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.nimbusds.jwt.JWT;
import com.nimbusds.jwt.JWTParser;
import com.quicktalk.bean.LoginRequestBean;
import com.quicktalk.bean.MessageResponseBean;
import com.quicktalk.bean.RegisterUserRequestBean;
import com.quicktalk.entity.Users;
import com.quicktalk.projection.UserProjection;
import com.quicktalk.repository.UserRepository;
import com.quicktalk.utilities.Utility;


@Service("UserServiceImpl")
public class UserServiceImpl implements UserService{
	
	@Autowired
	UserRepository userRepo;
	
	private static final Logger USER_SERVICE_LOG = LoggerFactory.getLogger(UserServiceImpl.class);

	public List<UserProjection> getAllUsers() {
		
		List<UserProjection> users = new ArrayList<>();
		USER_SERVICE_LOG.info("UserServiceImpl :: in getAllUsers()");
		try {
			users = userRepo.findAllProjectedBy();
		} catch (Exception e) {
			USER_SERVICE_LOG.info("UserServiceImpl :: Exception in getAllUsers :: {}",e);
		}
		USER_SERVICE_LOG.info("UserServiceImpl :: exit getAllUsers()");
		return users;
	}
	
	public MessageResponseBean registerUser(RegisterUserRequestBean registerUserRequest) {
		
		USER_SERVICE_LOG.info("UserServiceImpl :: in registerUser() :: registerUserRequest {}",registerUserRequest.toString());
		MessageResponseBean userResp = new MessageResponseBean();
		String errorMessage = validateRegisterUserReq(registerUserRequest);
		if (errorMessage.equals("")) {
			try {
				
				String idToken = registerUserRequest.getIdToken();
				JWT jwt = JWTParser.parse(idToken);
	            Map<String, Object> claims = jwt.getJWTClaimsSet().getClaims();
	            
	            USER_SERVICE_LOG.info("UserServiceImpl :: in registerUser() :: claims {}",claims);
	            
	            String email = (String) claims.get("email");
	            String username = (String) claims.get("name");
    
				Users newUser = new Users(username, email);
	
				Users registerUserResp = userRepo.saveAndFlush(newUser);
				userResp.setUserId(registerUserResp.getUserId().toString());
				userResp.setMessage("Successfully registered "+registerUserResp.getUsername());
				USER_SERVICE_LOG.info("UserServiceImpl :: User registered successfully :: exit registerUser()");
			} catch(Exception e) {
				USER_SERVICE_LOG.info("UserServiceImpl :: Exception in registerUser :: {}",e);
				userResp.setMessage("Failed to register user");
				USER_SERVICE_LOG.info("UserServiceImpl :: User registeration failed :: exit registerUser()");
			}
		}
		else {
			USER_SERVICE_LOG.info("UserServiceImpl :: Request validation failed :: exit registerUser()");
			userResp.setMessage(errorMessage);
		}
		return userResp;
	}

	private String validateRegisterUserReq(RegisterUserRequestBean registerUserRequest) {
		
		String error = "";
		USER_SERVICE_LOG.info("UserServiceImpl :: in validateRegisterUserReq()");
		if(Utility.isNull(registerUserRequest.getIdToken()))
			error = "ID token cannot be empty";

		USER_SERVICE_LOG.info("UserServiceImpl :: exit validateRegisterUserReq() :: error {}",error);
		return error;
	}
	
	@Override
    public MessageResponseBean loginUser(LoginRequestBean loginRequest) {
		String email = loginRequest.getEmail();
	
		Optional<Users> userOpt = userRepo.findByEmail(email);
	
		if (userOpt.isPresent()) {
			Users user = userOpt.get();
			return new MessageResponseBean(user.getUserId().toString(), "Successfully logged in", user.getUsername()); // Include username
		} else {
			return new MessageResponseBean(null, "Invalid credentials", null); // User not found
		}
	}
	@Override
    public Optional<String> getUserIdByUsername(String username) {
        USER_SERVICE_LOG.info("UserServiceImpl :: Fetching userId for username: {}", username);
        Optional<String> userId = userRepo.findUserIdByUsername(username);

        if (userId.isPresent()) {
            USER_SERVICE_LOG.info("UserServiceImpl :: Found userId: {}", userId.get());
        } else {
            USER_SERVICE_LOG.info("UserServiceImpl :: No userId found for username: {}", username);
        }

        return userId;
    }
	@Override
public Optional<UserProjection> getUserById(Integer userId) {
    USER_SERVICE_LOG.info("Attempting to fetch user by ID: {}", userId);
    try {
        Optional<UserProjection> userProjectionOpt = userRepo.findProjectedByUserId(userId);
        if (userProjectionOpt.isPresent()) {
            USER_SERVICE_LOG.info("User found: {}", userProjectionOpt.get().getUsername());
        } else {
            USER_SERVICE_LOG.info("No user found with ID: {}", userId);
        }
        return userProjectionOpt;
    } catch (Exception e) {
        USER_SERVICE_LOG.error("Error fetching user by ID: {}", e.getMessage());
        return Optional.empty();
    }
}
}